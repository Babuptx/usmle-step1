// Global State
let questionData = [];
let currentQuestionIndex = 0;
let userAnswers = {}; // Stores { questionIndex: selectedOptionIndex }
let flaggedQuestions = new Set();
let revealedQuestions = new Set(); // Tracks questions where 'Show Answer' was clicked
let isReviewMode = false;
let currentBlockFile = 'question_bank.json';

// Timer State
let timeRemaining = 3600; // 60 minutes in seconds
let timerInterval;

// Initialize Exam Block
async function loadBlock(filename) {
    try {
        // 1. Reset all global states for the new block
        currentQuestionIndex = 0;
        userAnswers = {};
        flaggedQuestions.clear();
        revealedQuestions.clear();
        isReviewMode = false;
        
        // 2. Reset and restart the timer
        clearInterval(timerInterval);
        timeRemaining = 3600; 
        
        // 3. Fetch the new JSON file
        const response = await fetch(`${filename}?t=${new Date().getTime()}`);
        const data = await response.json();
        questionData = data.questions || [];
        
        // 4. Update the UI Title
        document.getElementById('block-title').innerText = data.block_title || `USMLE Step 1 - ${filename}`;
        
        const btnEndBlock = document.getElementById('btn-end-block');
        if(btnEndBlock) btnEndBlock.classList.remove('hidden');

        // 5. Render questions if the file has data
        if (questionData.length > 0) {
            renderQuestion(currentQuestionIndex);
            generateNavigationGrid();
            startTimer();
        } else {
            document.getElementById('vignette-text').innerText = "This level is currently empty. Add questions to the JSON file!";
            document.getElementById('options-container').innerHTML = '';
            document.getElementById('question-grid').innerHTML = '';
            document.getElementById('question-number').innerText = "No Questions Found";
        }
    } catch (error) {
        console.error("Error loading question bank:", error);
        document.getElementById('vignette-text').innerText = "System Error: Failed to load block data.";
    }
}

// Setup Level Buttons
function setupLevelButtons() {
    const levelButtons = document.querySelectorAll('.lvl-btn');
    levelButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetFile = e.target.getAttribute('data-file');
            if (targetFile === currentBlockFile) return;

            const confirmSwitch = confirm("Are you sure you want to switch levels? Your current progress and timer will be reset.");
            if (confirmSwitch) {
                currentBlockFile = targetFile;
                levelButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                loadBlock(currentBlockFile);
            }
        });
    });
}

// Timer Logic
function startTimer() {
    timerInterval = setInterval(() => {
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            endBlock(); 
            return;
        }
        timeRemaining--;
        let minutes = Math.floor(timeRemaining / 60);
        let seconds = timeRemaining % 60;
        document.getElementById('exam-timer').innerText = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// --- NEW NAV WRAPPER: Handles the Reset Logic for Wrong Answers ---
function goToQuestion(newIndex) {
    // If not in final review mode, and the target question was previously revealed...
    if (!isReviewMode && revealedQuestions.has(newIndex)) {
        // If the previous answer was WRONG, scrub the data for a fresh evaluation
        if (userAnswers[newIndex] !== questionData[newIndex].correct_index) {
            delete userAnswers[newIndex];
            revealedQuestions.delete(newIndex);
        }
    }
    
    currentQuestionIndex = newIndex;
    renderQuestion(currentQuestionIndex);
    updateSidebarGrid();
}

// Render a Question
function renderQuestion(index) {
    if (!questionData || questionData.length === 0) return;
    
    const q = questionData[index];
    const isRevealed = revealedQuestions.has(index);
    
    document.getElementById('question-number').innerText = `Question ${index + 1}`;
    
    let tagsContainer = document.getElementById('question-tags');
    if (!tagsContainer) {
        tagsContainer = document.createElement('div');
        tagsContainer.id = 'question-tags';
        tagsContainer.className = 'question-tags';
        const vignette = document.getElementById('vignette-text');
        vignette.parentNode.insertBefore(tagsContainer, vignette);
    }
    
    if (q.discipline && q.system) {
        tagsContainer.innerHTML = `
            <span class="tag">Discipline: ${q.discipline}</span>
            <span class="tag">System: ${q.system}</span>
        `;
        tagsContainer.style.display = 'flex';
    } else {
        tagsContainer.style.display = 'none';
    }
    
    document.getElementById('vignette-text').innerText = q.vignette;
    
    const exhibitContainer = document.getElementById('exhibit-container');
    const exhibitImage = document.getElementById('exhibit-image');
    
    if (q.has_exhibit && q.exhibit_url) {
        exhibitImage.src = q.exhibit_url;
        exhibitContainer.classList.remove('hidden');
    } else {
        exhibitContainer.classList.add('hidden');
    }
    
    const flagBtn = document.getElementById('btn-flag');
    if (flaggedQuestions.has(index)) {
        flagBtn.innerText = '⚑ Unflag';
        flagBtn.style.backgroundColor = '#ffc107';
    } else {
        flagBtn.innerText = '⚑ Flag for Review';
        flagBtn.style.backgroundColor = '';
    }
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = ''; 
    
    q.options.forEach((opt, i) => {
        const label = document.createElement('label');
        label.className = 'option-label';
        
        const isChecked = userAnswers[index] === i ? 'checked' : '';
        const isDisabled = (isReviewMode || isRevealed) ? 'disabled' : '';
        
        label.innerHTML = `
            <input type="radio" name="q_options" value="${i}" ${isChecked} ${isDisabled}>
            <span class="option-text">${opt}</span>
        `;

        if (!isReviewMode && !isRevealed) {
            label.querySelector('input').addEventListener('change', (e) => {
                userAnswers[index] = parseInt(e.target.value);
                updateSidebarGrid();
            });
        }

        if (isReviewMode || isRevealed) {
            if (i === q.correct_index) {
                label.classList.add('correct-answer');
            } else if (userAnswers[index] === i && i !== q.correct_index) {
                label.classList.add('incorrect-answer');
            }
        }
        optionsContainer.appendChild(label);
    });
    
    const expContainer = document.getElementById('explanation-container');
    if (isReviewMode || isRevealed) {
        expContainer.classList.remove('hidden');
        let wrongRationalesHTML = q.explanation.incorrect_rationales.map(r => `<li>${r}</li>`).join('');
        
        document.getElementById('explanation-text').innerHTML = `
            <p><strong>Educational Objective:</strong> ${q.explanation.educational_objective}</p><br>
            <p><strong>Correct Answer:</strong> ${q.explanation.correct_rationale}</p><br>
            <p><strong>Incorrect Options:</strong></p>
            <ul class="rationale-list">${wrongRationalesHTML}</ul>
        `;
    } else {
        expContainer.classList.add('hidden');
    }
    
    document.getElementById('btn-prev').disabled = index === 0;
    const nextBtn = document.getElementById('btn-next');
    
    if (index === questionData.length - 1 && !isReviewMode) {
        nextBtn.innerText = 'End & Review Block';
        nextBtn.classList.add('danger');
    } else {
        nextBtn.innerText = 'Next ►';
        nextBtn.classList.remove('danger');
        if(index === questionData.length - 1 && isReviewMode) nextBtn.disabled = true;
    }

    const btnShowAnswer = document.getElementById('btn-show-answer');
    if (btnShowAnswer) {
        if (isReviewMode) {
            btnShowAnswer.classList.add('hidden');
        } else {
            btnShowAnswer.classList.remove('hidden');
            if (isRevealed) {
                btnShowAnswer.innerText = "Answer Revealed";
                btnShowAnswer.style.opacity = "0.5";
                btnShowAnswer.disabled = true;
                btnShowAnswer.style.cursor = "not-allowed";
            } else {
                btnShowAnswer.innerText = "👁 Show Answer";
                btnShowAnswer.style.opacity = "1";
                btnShowAnswer.disabled = false;
                btnShowAnswer.style.cursor = "pointer";
            }
        }
    }
}

// Generate the Grid
function generateNavigationGrid() {
    const grid = document.getElementById('question-grid');
    if (!grid) return; 
    grid.innerHTML = '';
    
    questionData.forEach((_, i) => {
        const btn = document.createElement('div');
        btn.className = 'nav-grid-btn';
        btn.id = `grid-btn-${i}`;
        
        btn.addEventListener('click', () => {
            goToQuestion(i);
        });
        grid.appendChild(btn);
    });
    updateSidebarGrid();
}

// Update Grid Visual States (Adding Ticks and Crosses)
function updateSidebarGrid() {
    questionData.forEach((q, i) => {
        const btn = document.getElementById(`grid-btn-${i}`);
        if (!btn) return;
        
        btn.className = 'nav-grid-btn'; 
        let btnText = `${i + 1}`;
        
        if (i === currentQuestionIndex) btn.classList.add('active');
        
        if (userAnswers[i] !== undefined) {
            btn.classList.add('answered');
            
            // Add ✅ or ❌ if the answer has been graded
            if (revealedQuestions.has(i) || isReviewMode) {
                if (userAnswers[i] === q.correct_index) {
                    btnText += ' ✅';
                } else {
                    btnText += ' ❌';
                }
            }
        }
        
        if (flaggedQuestions.has(i)) btn.classList.add('flagged');
        
        btn.innerText = btnText;
    });
}

// Flagging Logic
document.getElementById('btn-flag').addEventListener('click', () => {
    if (isReviewMode) return;
    if (flaggedQuestions.has(currentQuestionIndex)) {
        flaggedQuestions.delete(currentQuestionIndex);
    } else {
        flaggedQuestions.add(currentQuestionIndex);
    }
    renderQuestion(currentQuestionIndex);
    updateSidebarGrid();
});

// Show Answer Logic
const btnShowAnswerEvent = document.getElementById('btn-show-answer');
if (btnShowAnswerEvent) {
    btnShowAnswerEvent.addEventListener('click', () => {
        if (userAnswers[currentQuestionIndex] === undefined) {
            alert("Please select an answer first to test your knowledge!");
            return;
        }
        revealedQuestions.add(currentQuestionIndex);
        renderQuestion(currentQuestionIndex); 
        updateSidebarGrid(); // Immediately updates the grid with ✅ or ❌
    });
}

// End Block / Grade Test
function endBlock() {
    if (isReviewMode) return;
    
    const confirmSubmit = confirm("Are you sure you want to end the block? You will not be able to change your answers.");
    if (!confirmSubmit) return;

    clearInterval(timerInterval);
    isReviewMode = true;
    
    let score = 0;
    questionData.forEach((q, i) => {
        if (userAnswers[i] === q.correct_index) score++;
    });
    
    alert(`Block Completed! Score: ${score} / ${questionData.length} (${Math.round((score/questionData.length)*100)}%)`);
    
    document.getElementById('btn-end-block').classList.add('hidden');
    document.getElementById('exam-timer').innerText = "REVIEW MODE";
    
    // Jump back to Q1 for review
    goToQuestion(0); 
}

// Event Listeners for Standard Navigation (Utilizing the wrapper)
document.getElementById('btn-next').addEventListener('click', () => {
    if (currentQuestionIndex < questionData.length - 1) {
        goToQuestion(currentQuestionIndex + 1);
    } else if (!isReviewMode) {
        endBlock();
    }
});

document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        goToQuestion(currentQuestionIndex - 1);
    }
});

document.getElementById('btn-end-block').addEventListener('click', endBlock);

// Boot Up Sequence
window.onload = () => {
    setupLevelButtons();
    currentBlockFile = 'question_bank.json'; 
    loadBlock(currentBlockFile);
};

// Lab Values Modal Logic
const labModal = document.getElementById('lab-modal');
const btnLabValues = document.getElementById('btn-lab-values');
const btnCloseModal = document.getElementById('btn-close-modal');

if (btnLabValues && labModal && btnCloseModal) {
    btnLabValues.addEventListener('click', () => labModal.classList.remove('hidden'));
    btnCloseModal.addEventListener('click', () => labModal.classList.add('hidden'));
    window.addEventListener('click', (event) => {
        if (event.target === labModal) labModal.classList.add('hidden');
    });
}