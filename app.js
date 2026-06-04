let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let questionsAttempted = 0;

// DOM Elements
const blockTitleDisplay = document.getElementById('block-title-display');
const questionCounter = document.getElementById('question-counter');
const scoreDisplay = document.getElementById('score-display');
const vignetteText = document.getElementById('vignette-text');
const optionsContainer = document.getElementById('options-container');
const disciplineTag = document.getElementById('discipline-tag');
const systemTag = document.getElementById('system-tag');
const feedbackBox = document.getElementById('feedback-box');
const feedbackTitle = document.getElementById('feedback-title');
const educationalObjective = document.getElementById('educational-objective');
const correctRationale = document.getElementById('correct-rationale');
const incorrectRationales = document.getElementById('incorrect-rationales');
const nextBtn = document.getElementById('next-btn');
const levelButtons = document.querySelectorAll('.lvl-btn');

// Initialize the app
function init() {
    // Attach click events to level buttons
    levelButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all
            levelButtons.forEach(b => b.classList.remove('active'));
            // Add to clicked
            e.target.classList.add('active');
            // Load the corresponding file
            const fileToLoad = e.target.getAttribute('data-file');
            loadBlock(fileToLoad);
        });
    });

    // Load initial block (Block 1)
    loadBlock('block1.json');

    // Next button event listener
    nextBtn.addEventListener('click', loadNextQuestion);
}

// Fetch JSON data
async function loadBlock(filename) {
    try {
        const response = await fetch(filename);
        if (!response.ok) throw new Error("File not found");
        const data = await response.json();
        
        blockTitleDisplay.textContent = data.block_title;
        currentQuestions = data.questions;
        
        // Reset Progress
        currentQuestionIndex = 0;
        score = 0;
        questionsAttempted = 0;
        updateStats();
        
        displayQuestion();
    } catch (error) {
        console.error("Error loading block:", error);
        vignetteText.textContent = "Error loading questions. Please ensure the JSON file is uploaded to the server.";
        optionsContainer.innerHTML = "";
    }
}

// Display current question
function displayQuestion() {
    feedbackBox.classList.add('hidden');
    optionsContainer.innerHTML = '';
    
    if (currentQuestionIndex >= currentQuestions.length) {
        vignetteText.textContent = `Block Complete! Final Score: ${Math.round((score / questionsAttempted) * 100)}%`;
        disciplineTag.style.display = 'none';
        systemTag.style.display = 'none';
        return;
    }

    const q = currentQuestions[currentQuestionIndex];
    
    disciplineTag.style.display = 'inline-block';
    systemTag.style.display = 'inline-block';
    disciplineTag.textContent = q.discipline;
    systemTag.textContent = q.system;
    
    vignetteText.textContent = q.vignette;
    updateStats();

    q.options.forEach((optionText, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = `${String.fromCharCode(65 + index)}. ${optionText}`;
        btn.onclick = () => handleAnswer(index, q.correct_index, q.explanation);
        optionsContainer.appendChild(btn);
    });
}

// Handle Answer Selection
function handleAnswer(selectedIndex, correctIndex, explanation) {
    const buttons = optionsContainer.querySelectorAll('.option-btn');
    
    // Disable all buttons
    buttons.forEach(btn => btn.disabled = true);
    
    questionsAttempted++;

    if (selectedIndex === correctIndex) {
        buttons[selectedIndex].classList.add('correct');
        score++;
        feedbackTitle.textContent = "Correct!";
        feedbackTitle.className = "text-correct";
    } else {
        buttons[selectedIndex].classList.add('incorrect');
        buttons[correctIndex].classList.add('correct');
        feedbackTitle.textContent = "Incorrect";
        feedbackTitle.className = "text-incorrect";
    }

    updateStats();
    showFeedback(explanation);
}

// Display Explanation
function showFeedback(explanation) {
    educationalObjective.textContent = `Objective: ${explanation.educational_objective}`;
    correctRationale.textContent = explanation.correct_rationale;
    
    incorrectRationales.innerHTML = '';
    explanation.incorrect_rationales.forEach(rationale => {
        const p = document.createElement('p');
        p.textContent = rationale;
        incorrectRationales.appendChild(p);
    });

    feedbackBox.classList.remove('hidden');
}

// Load next question
function loadNextQuestion() {
    currentQuestionIndex++;
    displayQuestion();
    window.scrollTo(0, 0); // Scroll to top for next question
}

// Update counters
function updateStats() {
    questionCounter.textContent = `${currentQuestionIndex + 1} / ${currentQuestions.length}`;
    if (questionsAttempted > 0) {
        scoreDisplay.textContent = `${Math.round((score / questionsAttempted) * 100)}%`;
    } else {
        scoreDisplay.textContent = `0%`;
    }
}

// Boot up the app
init();