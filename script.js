document.addEventListener('DOMContentLoaded', () => {
    const csvFileInput = document.getElementById('csvFile');
    const fileInfoMessage = document.getElementById('fileInfoMessage');
    const cardFrontText = document.getElementById('cardFrontText');
    const cardBackChinese = document.getElementById('cardBackChinese');
    const cardBackPinyin = document.getElementById('cardBackPinyin');
    const cardBackMeaning = document.getElementById('cardBackMeaning');

    const interactiveCard = document.getElementById('interactiveCard');
    const prevCardButton = document.getElementById('prevCard');
    const nextCardButton = document.getElementById('nextCard');
    const showAnswerButton = document.getElementById('showAnswer');
    const cardCounterElement = document.getElementById('cardCounter');

    const modeButtons = document.querySelectorAll('.mode-button');

    const autoAdvanceToggle = document.getElementById('autoAdvanceToggle');
    const autoAdvanceSliderGroup = document.getElementById('autoAdvanceSliderGroup');
    const autoAdvanceSlider = document.getElementById('autoAdvanceSlider');
    const autoAdvanceValueDisplay = document.getElementById('autoAdvanceValue');

    let originalFlashcards = [];
    let currentDeck = [];
    let currentCardIndex = 0;
    let isFlipped = false;
    let learningMode = 'sequential';

    let autoAdvanceEnabled = false;
    let autoAdvanceDuration = 5;
    let autoAdvanceTimerId = null;

    let touchstartX = 0;
    let touchendX = 0;
    const swipeThreshold = 50;

    // --- Event Listeners ---
    csvFileInput.addEventListener('change', handleFileUpload);
    interactiveCard.addEventListener('click', flipCardVisuals);
    showAnswerButton.addEventListener('click', flipCardVisuals);
    prevCardButton.addEventListener('click', () => navigateCard('prev'));
    nextCardButton.addEventListener('click', () => navigateCard('next'));

    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (button.disabled || button.classList.contains('active')) return;
            learningMode = button.dataset.mode;
            modeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            resetDeckForNewMode();
        });
    });

    autoAdvanceToggle.addEventListener('change', (e) => {
        autoAdvanceEnabled = e.target.checked;
        autoAdvanceSliderGroup.style.display = autoAdvanceEnabled ? 'flex' : 'none';
        clearAutoAdvanceTimer();
        if (autoAdvanceEnabled && currentDeck.length > 0 && currentCardIndex < currentDeck.length -1) {
            startAutoAdvanceTimer();
        }
        updateAutoAdvanceUIDisabledState();
    });

    autoAdvanceSlider.addEventListener('input', (e) => {
        autoAdvanceDuration = parseInt(e.target.value, 10);
        autoAdvanceValueDisplay.textContent = `${autoAdvanceDuration}s`;
        clearAutoAdvanceTimer();
        if (autoAdvanceEnabled && currentDeck.length > 0 && currentCardIndex < currentDeck.length -1) {
            startAutoAdvanceTimer();
        }
    });

    interactiveCard.addEventListener('touchstart', (e) => {
        touchstartX = e.changedTouches[0].screenX;
    }, { passive: true });

    interactiveCard.addEventListener('touchend', (e) => {
        touchendX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    // --- Core Functions ---
    function handleFileUpload(event) {
        clearAutoAdvanceTimer();
        const file = event.target.files[0];
        if (file) {
            fileInfoMessage.textContent = `Loading "${file.name}"...`;
            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                parseCSV(text);
                enableModeButtons(originalFlashcards.length > 0);
                updateAutoAdvanceUIDisabledState();

                if (originalFlashcards.length > 0) {
                    fileInfoMessage.textContent = `Loaded ${originalFlashcards.length} cards from "${file.name}".`;
                } else {
                    fileInfoMessage.textContent = `Could not load cards from "${file.name}". Ensure format is correct.`;
                }
                resetDeckForNewMode();
            };
            reader.readAsText(file);
        } else {
            fileInfoMessage.textContent = "";
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
        clearAutoAdvanceTimer();
        if (learningMode === 'random') {
            currentDeck = [...originalFlashcards];
            for (let i = currentDeck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [currentDeck[i], currentDeck[j]] = [currentDeck[j], currentDeck[i]];
            }
        } else {
            currentDeck = [...originalFlashcards];
        }
        currentCardIndex = 0;

        if (currentDeck.length > 0) {
            displayCard(true);
        } else {
            cardFrontText.textContent = 'Upload a CSV to start!';
            clearBackCard();
            resetCardFlipVisuals();
            updateCardCounter(0, 0);
            disableAllCardInteraction(true);
        }
        updateNavigationStates();
    }

    function displayCard(isInitialLoad = false) {
        clearAutoAdvanceTimer();
        interactiveCard.classList.remove('swiping-left', 'swiping-right');

        if (currentDeck.length === 0 || currentCardIndex < 0 || currentCardIndex >= currentDeck.length) {
            cardFrontText.textContent = 'No cards. Upload a CSV.';
            clearBackCard();
            updateCardCounter(0, 0);
            disableAllCardInteraction(true);
            updateNavigationStates();
            return;
        }

        disableAllCardInteraction(false);

        const card = currentDeck[currentCardIndex];
        cardFrontText.textContent = card.chinese;
        cardBackChinese.textContent = card.chinese;
        cardBackPinyin.textContent = card.pinyin;
        cardBackMeaning.textContent = card.meaning;

        if (!isInitialLoad) {
            resetCardFlipVisuals();
        } else if (isFlipped) {
             resetCardFlipVisuals();
        }

        updateCardCounter(currentCardIndex + 1, currentDeck.length);
        updateNavigationStates();

        if (autoAdvanceEnabled && currentDeck.length > 0 && currentCardIndex < currentDeck.length - 1) {
            startAutoAdvanceTimer();
        }
    }

    function navigateCard(direction, viaSwipe = false) {
        clearAutoAdvanceTimer();
        let canNavigate = false;

        if (direction === 'next' && currentCardIndex < currentDeck.length - 1) {
            currentCardIndex++;
            canNavigate = true;
        } else if (direction === 'prev' && currentCardIndex > 0) {
            currentCardIndex--;
            canNavigate = true;
        }

        if (canNavigate) {
            interactiveCard.classList.add(direction === 'next' ? 'swiping-left' : 'swiping-right');
            setTimeout(() => {
                displayCard();
            }, 150);
        }
    }

    function handleSwipe() {
        if (isFlipped && currentDeck.length > 1) return;

        const swipeDiff = touchstartX - touchendX;
        const swipeAbs = Math.abs(swipeDiff);

        if (swipeAbs > swipeThreshold) {
            if (swipeDiff > 0) {
                navigateCard('next', true);
            } else {
                navigateCard('prev', true);
            }
        }
        touchstartX = 0;
        touchendX = 0;
    }

    function clearBackCard() {
        cardBackChinese.textContent = '';
        cardBackPinyin.textContent = '';
        cardBackMeaning.textContent = '';
    }

    function flipCardVisuals() {
        if (currentDeck.length === 0) return;
        interactiveCard.classList.toggle('is-flipped');
        isFlipped = !isFlipped;
    }

    function resetCardFlipVisuals() {
        if (isFlipped) {
            interactiveCard.classList.remove('is-flipped');
            isFlipped = false;
        }
    }

    function startAutoAdvanceTimer() {
        clearAutoAdvanceTimer();
        if (autoAdvanceEnabled && autoAdvanceDuration > 0 && currentDeck.length > 0 && currentCardIndex < currentDeck.length -1) {
            autoAdvanceTimerId = setTimeout(() => {
                if (autoAdvanceEnabled) {
                     navigateCard('next');
                }
            }, autoAdvanceDuration * 1000);
        }
    }

    function clearAutoAdvanceTimer() {
        if (autoAdvanceTimerId) {
            clearTimeout(autoAdvanceTimerId);
            autoAdvanceTimerId = null;
        }
    }

    function updateNavigationStates() {
        const noCards = currentDeck.length === 0;
        prevCardButton.disabled = noCards || currentCardIndex === 0;
        nextCardButton.disabled = noCards || currentCardIndex === currentDeck.length - 1;
    }

    function disableAllCardInteraction(disabled) {
        showAnswerButton.disabled = disabled || currentDeck.length === 0;
        if (disabled) {
            prevCardButton.disabled = true;
            nextCardButton.disabled = true;
        }
    }

    function enableModeButtons(enable) {
        modeButtons.forEach(button => button.disabled = !enable);
    }

    function updateAutoAdvanceUIDisabledState() {
        const noCards = originalFlashcards.length === 0;
        autoAdvanceToggle.disabled = noCards;
        autoAdvanceSlider.disabled = noCards || !autoAdvanceEnabled;
        if(noCards && autoAdvanceToggle.checked) {
            autoAdvanceToggle.checked = false;
            autoAdvanceEnabled = false;
            autoAdvanceSliderGroup.style.display = 'none';
            clearAutoAdvanceTimer();
        }
    }

    function updateCardCounter(current, total) {
        if (total === 0) {
            cardCounterElement.textContent = `0 / 0`;
        } else {
            cardCounterElement.textContent = `${current} / ${total}`;
        }
    }

    // Initial setup
    enableModeButtons(false);
    updateAutoAdvanceUIDisabledState();
    resetDeckForNewMode();
});
