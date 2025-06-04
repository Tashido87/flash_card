document.addEventListener('DOMContentLoaded', () => {
    const csvFileInput = document.getElementById('csvFile');
    const cardFrontText = document.getElementById('cardFrontText');
    const cardBackChinese = document.getElementById('cardBackChinese');
    const cardBackPinyin = document.getElementById('cardBackPinyin');
    const cardBackMeaning = document.getElementById('cardBackMeaning');

    const flashcardElement = document.querySelector('.flashcard');
    const prevCardButton = document.getElementById('prevCard');
    const nextCardButton = document.getElementById('nextCard');
    const showAnswerButton = document.getElementById('showAnswer');
    const cardCounterElement = document.getElementById('cardCounter');

    const modeButtons = document.querySelectorAll('.mode-button');

    let originalFlashcards = [];
    let currentDeck = [];
    let currentCardIndex = 0;
    let isFlipped = false;
    let learningMode = 'sequential'; // Default mode

    // --- Event Listeners ---
    csvFileInput.addEventListener('change', handleFileUpload);
    flashcardElement.addEventListener('click', flipCardVisuals);
    showAnswerButton.addEventListener('click', flipCardVisuals);
    prevCardButton.addEventListener('click', showPreviousCard);
    nextCardButton.addEventListener('click', showNextCard);

    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Do nothing if the button is disabled or already active
            if (button.disabled || button.classList.contains('active')) return;

            learningMode = button.dataset.mode;
            modeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            resetDeckForNewMode();
        });
    });

    // --- Core Functions ---
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                parseCSV(text);
                // Enable mode buttons now that cards are potentially loaded
                enableModeButtons(originalFlashcards.length > 0);

                resetDeckForNewMode(); // This will also call displayCard if cards exist

                if (currentDeck.length === 0 && originalFlashcards.length > 0) {
                    // This case shouldn't happen if resetDeckForNewMode is correct, but as a fallback:
                    cardFrontText.textContent = 'Error processing cards.';
                    clearBackCard();
                } else if (originalFlashcards.length === 0) {
                    cardFrontText.textContent = 'CSV invalid or empty. Use "Chinese,Pinyin,Meaning" format.';
                    clearBackCard();
                }
                updateCardCounter(currentCardIndex +1 , currentDeck.length); // Ensure counter updates
                updateNavigation(); // Ensure nav buttons update
            };
            reader.readAsText(file);
        }
    }

    function parseCSV(csvText) {
        originalFlashcards = [];
        const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
        lines.forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 3 && parts[0].trim() !== "") {
                originalFlashcards.push({
                    chinese: parts[0].trim(),
                    pinyin: parts[1].trim(),
                    meaning: parts.slice(2).join(',').trim()
                });
            }
        });
    }

    function resetDeckForNewMode() {
        if (learningMode === 'random') {
            currentDeck = [...originalFlashcards];
            // Fisher-Yates Shuffle
            for (let i = currentDeck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [currentDeck[i], currentDeck[j]] = [currentDeck[j], currentDeck[i]];
            }
        } else {
            currentDeck = [...originalFlashcards];
        }
        currentCardIndex = 0;

        if (currentDeck.length > 0) {
            displayCard();
        } else {
            // Handle case where there are no cards (e.g., after uploading an empty/invalid CSV)
            cardFrontText.textContent = 'Upload a CSV to start!';
            clearBackCard();
            resetCardFlipVisuals();
            updateCardCounter(0, 0);
            disableCardControls(true); // Disable show answer, prev/next
        }
        updateNavigation(); // Always update nav button states
    }

    function displayCard() {
        if (currentDeck.length === 0 || currentCardIndex < 0 || currentCardIndex >= currentDeck.length) {
            // This state should ideally be managed by resetDeckForNewMode if deck is empty
            cardFrontText.textContent = 'No cards to display. Upload a CSV.';
            clearBackCard();
            updateCardCounter(0, 0);
            disableCardControls(true);
            updateNavigation(); // Ensure nav buttons are disabled
            return;
        }

        disableCardControls(false); // Enable show answer if card is displayed

        const card = currentDeck[currentCardIndex];
        cardFrontText.textContent = card.chinese;
        cardBackChinese.textContent = card.chinese;
        cardBackPinyin.textContent = card.pinyin;
        cardBackMeaning.textContent = card.meaning;

        resetCardFlipVisuals();
        updateCardCounter(currentCardIndex + 1, currentDeck.length);
        updateNavigation(); // Update prev/next button states
    }

    function clearBackCard() {
        cardBackChinese.textContent = '';
        cardBackPinyin.textContent = '';
        cardBackMeaning.textContent = '';
    }

    function flipCardVisuals() {
        if (currentDeck.length === 0) return; // Don't flip if no cards
        flashcardElement.classList.toggle('is-flipped');
        isFlipped = !isFlipped;
    }

    function resetCardFlipVisuals() {
        if (isFlipped) {
            flashcardElement.classList.remove('is-flipped');
            isFlipped = false;
        }
    }

    function showPreviousCard() {
        if (currentCardIndex > 0) {
            currentCardIndex--;
            displayCard();
        }
    }

    function showNextCard() {
        if (currentCardIndex < currentDeck.length - 1) {
            currentCardIndex++;
            displayCard();
        }
    }

    function updateNavigation() {
        const noCards = currentDeck.length === 0;
        prevCardButton.disabled = noCards || currentCardIndex === 0;
        nextCardButton.disabled = noCards || currentCardIndex === currentDeck.length - 1;
    }

    function disableCardControls(disabled) {
        showAnswerButton.disabled = disabled || currentDeck.length === 0;
    }

    function enableModeButtons(enable) {
        modeButtons.forEach(button => button.disabled = !enable);
    }

    function updateCardCounter(current, total) {
        if (total === 0) {
            cardCounterElement.textContent = `0 / 0`;
        } else {
            cardCounterElement.textContent = `${current} / ${total}`;
        }
    }

    // Initial setup
    enableModeButtons(false); // Disable mode buttons initially
    resetDeckForNewMode();  // Initialize with empty deck & UI placeholders
});