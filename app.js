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
        
        // 3. Fetch the new JSON file (with a cache-busting timestamp)
        const response = await fetch(`${filename}?t=${new Date().getTime()}`);
        const data = await response.json();
        questionData = data.questions || [];
        
        // 4. Update the UI Title
        document.getElementById('block-title').innerText = data.block_title || `USMLE Step 1 - ${filename}`;
        
        // Ensure End Block button is visible again
        const btnEndBlock = document.getElementById('btn-end-block');
        if(btnEndBlock) btnEndBlock.classList.remove('hidden');

        // 5. Render questions if the file has data
        if (questionData.length > 0) {
            renderQuestion(currentQuestionIndex);
            generateNavigationGrid();
            startTimer();
        } else {
            // Failsafe for empty JSON files (like block3.json)
            document.getElementById('vignette-text').innerText = "This level is currently empty. Add questions to the JSON file!";
            document.getElementById('options-container').innerHTML = '';
            document.getElementById('question-grid').innerHTML = '';
            document.getElementById('question-number').innerText = "No Questions Found";
        }
    } catch (error) {
        console.error("Error loading question bank:", error);
        document.getElementById('vignette-text').innerText = "System Error: Failed to load block data. Ensure the JSON file exists and is formatted correctly.";
    }
}

// Setup Level Buttons (L-1 through L-7)
function setupLevelButtons() {
    const levelButtons = document.querySelectorAll('.lvl-btn');
    levelButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetFile = e.target.getAttribute('data-file');
            
            // Do nothing if they click the level they are already on
            if (targetFile === currentBlockFile) return;

            // Warn the user before wiping their current progress
            const confirmSwitch = confirm("Are you sure you want to switch levels? Your current progress and timer will be reset.");
            
            if (confirmSwitch) {
                currentBlockFile = targetFile;
                
                // Remove active class from all buttons, add to the clicked one
                levelButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Load the newly selected block
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
            endBlock(); // Auto-submit when time is up
            return;
        }
        timeRemaining--;
        let minutes = Math.floor(timeRemaining / 60);
        let seconds = timeRemaining % 60;
        document.getElementById('exam-timer').innerText = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// Render a Question
function renderQuestion(index) {
    if (!questionData || questionData.length === 0) return;
    
    const q = questionData[index];
    const isRevealed = revealedQuestions.has(index);
    
    // Update Header & Text
    document.getElementById('question-number').innerText = `Question ${index + 1}`;
    document.getElementById('vignette-text').innerText = q.vignette;
    
    // --- Image Exhibit Logic ---
    const exhibitContainer = document.getElementById('exhibit-container');
    const exhibitImage = document.getElementById('exhibit-image');
    
    if (q.has_exhibit && q.exhibit_url) {
        exhibitImage.src = q.exhibit_url;
        exhibitContainer.classList.remove('hidden');
    } else {
        exhibitContainer.classList.add('hidden');
    }
    
    // Update Flag Button UI
    const flagBtn = document.getElementById('btn-flag');
    if (flaggedQuestions.has(index)) {
        flagBtn.innerText = '⚑ Unflag';
        flagBtn.style.backgroundColor = '#ffc107';
    } else {
        flagBtn.innerText = '⚑ Flag for Review';
        flagBtn.style.backgroundColor = '';
    }
    
    // Render Multiple Choice Options
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

        // Listen for selection changes (only if not locked by review or reveal)
        if (!isReviewMode && !isRevealed) {
            label.querySelector('input').addEventListener('change', (e) => {
                userAnswers[index] = parseInt(e.target.value);
                updateSidebarGrid();
            });
        }

        // Apply Grading Styles if in Review Mode OR if Answer is Revealed
        if (isReviewMode || isRevealed) {
            if (i === q.correct_index) {
                label.classList.add('correct-answer');
            } else if (userAnswers[index] === i && i !== q.correct_index) {
                label.classList.add('incorrect-answer');
            }
        }
        
        optionsContainer.appendChild(label);
    });
    
    // Render Explanation if in Review Mode OR if Revealed
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
    
    // Update Footer Navigation Button States
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

    // Update Show Answer (Tutor Mode) Button UI
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

// Horizontal Navigation Grid (with Q- prefixes)
function generateNavigationGrid() {
    const grid = document.getElementById('question-grid');
    if (!grid) return; // Safety check
    grid.innerHTML = '';
    
    questionData.forEach((_, i) => {
        const btn = document.createElement('div');
        btn.className = 'nav-grid-btn';
        btn.id = `grid-btn-${i}`;
        
        // This adds the Q-1, Q-2 labeling to the horizontal boxes
        btn.innerText = `Q-${i + 1}`;
        
        btn.addEventListener('click', () => {
            currentQuestionIndex = i;
            renderQuestion(currentQuestionIndex);
            updateSidebarGrid();
        });
        grid.appendChild(btn);
    });
    updateSidebarGrid();
}

// Update Grid Visual States (Active, Answered, Flagged)
function updateSidebarGrid() {
    questionData.forEach((_, i) => {
        const btn = document.getElementById(`grid-btn-${i}`);
        if (!btn) return;
        
        // Reset classes
        btn.className = 'nav-grid-btn'; 
        
        // Apply states
        if (i === currentQuestionIndex) btn.classList.add('active');
        if (userAnswers[i] !== undefined) btn.classList.add('answered');
        if (flaggedQuestions.has(i)) btn.classList.add('flagged');
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

// Show Answer Logic (Tutor Mode)
const btnShowAnswerEvent = document.getElementById('btn-show-answer');
if (btnShowAnswerEvent) {
    btnShowAnswerEvent.addEventListener('click', () => {
        if (userAnswers[currentQuestionIndex] === undefined) {
            alert("Please select an answer first to test your knowledge!");
            return;
        }
        revealedQuestions.add(currentQuestionIndex);
        renderQuestion(currentQuestionIndex); // Re-render to show explanation and lock choices
    });
}

// End Block / Grade Test
function endBlock() {
    if (isReviewMode) return;
    
    const confirmSubmit = confirm("Are you sure you want to end the block? You will not be able to change your answers.");
    if (!confirmSubmit) return;

    clearInterval(timerInterval);
    isReviewMode = true;
    currentQuestionIndex = 0; // Jump back to Q1 for review
    
    // Calculate basic score
    let score = 0;
    questionData.forEach((q, i) => {
        if (userAnswers[i] === q.correct_index) score++;
    });
    
    alert(`Block Completed! Score: ${score} / ${questionData.length} (${Math.round((score/questionData.length)*100)}%)`);
    
    // Switch UI to review mode
    document.getElementById('btn-end-block').classList.add('hidden');
    document.getElementById('exam-timer').innerText = "REVIEW MODE";
    renderQuestion(currentQuestionIndex);
}

// Event Listeners for Standard Navigation
document.getElementById('btn-next').addEventListener('click', () => {
    if (currentQuestionIndex < questionData.length - 1) {
        currentQuestionIndex++;
        renderQuestion(currentQuestionIndex);
        updateSidebarGrid();
    } else if (!isReviewMode) {
        endBlock();
    }
});

document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion(currentQuestionIndex);
        updateSidebarGrid();
    }
});

document.getElementById('btn-end-block').addEventListener('click', endBlock);

// Boot Up Sequence
window.onload = () => {
    setupLevelButtons(); // Initialize the L-1 to L-7 listeners
    currentBlockFile = 'question_bank.json'; // Set the default load file
    loadBlock(currentBlockFile);
};

// --- Lab Values Modal Logic ---
const labModal = document.getElementById('lab-modal');
const btnLabValues = document.getElementById('btn-lab-values');
const btnCloseModal = document.getElementById('btn-close-modal');

if (btnLabValues && labModal && btnCloseModal) {
    btnLabValues.addEventListener('click', () => labModal.classList.remove('hidden'));
    btnCloseModal.addEventListener('click', () => labModal.classList.add('hidden'));
    // Close modal if user clicks anywhere outside of the modal content window
    window.addEventListener('click', (event) => {
        if (event.target === labModal) labModal.classList.add('hidden');
    });
}