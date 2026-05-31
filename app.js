// Global State
let questionData = [];
let currentQuestionIndex = 0;
let userAnswers = {}; // Stores { questionIndex: selectedOptionIndex }
let flaggedQuestions = new Set();
let isReviewMode = false;

// Timer State
let timeRemaining = 3600; // 60 minutes in seconds
let timerInterval;

// Initialize Exam
async function loadQuestions() {
    try {
        const response = await fetch('question_bank.json');
        const data = await response.json();
        questionData = data.questions;
        
        document.getElementById('block-title').innerText = data.block_title;
        renderQuestion(currentQuestionIndex);
        generateNavigationGrid();
        startTimer();
    } catch (error) {
        console.error("Error loading question bank:", error);
        document.getElementById('vignette-text').innerText = "System Error: Failed to load question bank.";
    }
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
    
    // Update Header & Text
    document.getElementById('question-number').innerText = `Question ${index + 1}`;
    document.getElementById('vignette-text').innerText = q.vignette;
    
    // Update Flag Button UI
    const flagBtn = document.getElementById('btn-flag');
    if (flaggedQuestions.has(index)) {
        flagBtn.innerText = '⚑ Unflag';
        flagBtn.style.backgroundColor = '#ffc107';
    } else {
        flagBtn.innerText = '⚑ Flag for Review';
        flagBtn.style.backgroundColor = '';
    }
    
    // Render Options
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = ''; 
    
    q.options.forEach((opt, i) => {
        const label = document.createElement('label');
        label.className = 'option-label';
        
        const isChecked = userAnswers[index] === i ? 'checked' : '';
        const isDisabled = isReviewMode ? 'disabled' : '';
        
        label.innerHTML = `
            <input type="radio" name="q_options" value="${i}" ${isChecked} ${isDisabled}>
            <span class="option-text">${opt}</span>
        `;

        // Listen for selection changes (only if not in review mode)
        if (!isReviewMode) {
            label.querySelector('input').addEventListener('change', (e) => {
                userAnswers[index] = parseInt(e.target.value);
                updateSidebarGrid();
            });
        }

        // Apply Grading Styles if in Review Mode
        if (isReviewMode) {
            if (i === q.correct_index) {
                label.classList.add('correct-answer');
            } else if (userAnswers[index] === i && i !== q.correct_index) {
                label.classList.add('incorrect-answer');
            }
        }
        
        optionsContainer.appendChild(label);
    });
    
    // Render Explanation if in Review Mode
    const expContainer = document.getElementById('explanation-container');
    if (isReviewMode) {
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
    
    // Update Footer Navigation state
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
}

// Sidebar Navigation Grid
function generateNavigationGrid() {
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';
    
    questionData.forEach((_, i) => {
        const btn = document.createElement('div');
        btn.className = 'nav-grid-btn';
        btn.id = `grid-btn-${i}`;
        btn.innerText = i + 1;
        
        btn.addEventListener('click', () => {
            currentQuestionIndex = i;
            renderQuestion(currentQuestionIndex);
            updateSidebarGrid();
        });
        grid.appendChild(btn);
    });
    updateSidebarGrid();
}

// Update Sidebar Visual States
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

// Event Listeners for Buttons
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

// Boot up
window.onload = loadQuestions;
