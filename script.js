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

    // --- Event Listeners --- (Remain the same as previous full code)
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
                console.log("File content loaded, starting CSV parse..."); // Added log
                parseCSV(text); // Call to the modified parseCSV
                enableModeButtons(originalFlashcards.length > 0);
                updateAutoAdvanceUIDisabledState();

                if (originalFlashcards.length > 0) {
                    fileInfoMessage.textContent = `Loaded ${originalFlashcards.length} cards from "${file.name}".`;
                } else {
                    // This error message is shown if parseCSV doesn't populate originalFlashcards
                    fileInfoMessage.textContent = `Could not load cards from "${file.name}". Ensure CSV format is correct. Check console (F12) for details.`;
                }
                resetDeckForNewMode();
            };
            reader.readAsText(file);
        } else {
            fileInfoMessage.textContent = "";
        }
    }

    /**
     * Parses CSV text into flashcards.
     * Each line should be in the format: Chinese,Pinyin,Meaning
     * Logs detailed information to the console for debugging.
     */
    function parseCSV(csvText) {
        originalFlashcards = []; // Reset the array
        console.log("Attempting to parse CSV data. First 500 chars of content:", csvText.substring(0, 500));

        if (!csvText || csvText.trim() === "") {
            console.warn("CSV content is empty or consists only of whitespace.");
            fileInfoMessage.textContent = "CSV file appears to be empty or invalid."; // User-facing message
            return;
        }

        const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
        console.log(`Found ${lines.length} non-empty lines to process.`);

        if (lines.length === 0) {
            console.warn("No processable lines found after filtering empty/whitespace lines from CSV.");
            fileInfoMessage.textContent = "CSV contains no processable lines of data."; // User-facing message
            return;
        }

        let skippedLinesCount = 0;
        let addedLinesCount = 0;
        lines.forEach((line, index) => {
            const parts = line.split(',');
            // Log details for the first few lines AND for any lines that cause issues
            const shouldLogDetails = index < 3 || (parts.length < 3 || (parts.length > 0 && parts[0].trim() === ""));

            if (shouldLogDetails) {
                console.log(`Processing line ${index + 1}: "${line}" -> Parts (${parts.length}): [${parts.join(' | ')}]`);
            }

            // CRITICAL CONDITION: Must have at least 3 parts, and the first part (Chinese word) must not be empty.
            if (parts.length >= 3 && parts[0].trim() !== "") {
                originalFlashcards.push({
                    chinese: parts[0].trim(),
                    pinyin: parts[1].trim(),
                    meaning: parts.slice(2).join(',').trim() // Handles commas in the meaning part
                });
                addedLinesCount++;
            } else {
                skippedLinesCount++;
                if (shouldLogDetails || skippedLinesCount % 20 === 0) { // Log details for skipped lines
                    console.warn(`Skipped line ${index + 1}: Does not meet criteria (parts.length >= 3 AND first part not empty). Actual parts found: ${parts.length}. First part content: "${parts.length > 0 ? parts[0].trim() : 'N/A'}"`);
                }
            }
        });

        if (skippedLinesCount > 0) {
            console.warn(`Total lines skipped due to formatting issues: ${skippedLinesCount} out of ${lines.length} processable lines.`);
        }
        console.log(`CSV parsing finished. Total cards successfully parsed and added: ${addedLinesCount}.`);
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
            displayCard(true); // Pass true for initial load/reset
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

        if (!isInitialLoad) { // Only reset flip if not initial load, to avoid flicker if it was already front
            resetCardFlipVisuals();
        } else if (isFlipped) { // If it's an initial load but somehow the card is flipped, reset it.
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
        // const oldCardIndex = currentCardIndex; // Not currently used
        let canNavigate = false;

        if (direction === 'next' && currentCardIndex < currentDeck.length - 1) {
            currentCardIndex++;
            canNavigate = true;
        } else if (direction === 'prev' && currentCardIndex > 0) {
            currentCardIndex--;
            canNavigate = true;
        }

        if (canNavigate) {
            const animationClass = direction === 'next' ? 'swiping-left' : 'swiping-right';
            interactiveCard.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out'; // Apply transition for both swipe/button
            interactiveCard.classList.add(animationClass);

            setTimeout(() => {
                displayCard(); // This will remove swipe classes and load new content
            }, 150); // Single delay, adjust if needed. 150ms gives some animation time.
        } else if (autoAdvanceEnabled && direction === 'next' && currentCardIndex === currentDeck.length -1) {
            console.log("Auto-advance reached end of deck.");
        }
    }

    function handleSwipe() {
        if (isFlipped && currentDeck.length > 1) return; // Disable swipe to navigate if card is flipped and there are other cards to navigate to.
                                          // Allows flipping back by clicking then swiping. If only one card, swipe does nothing anyway.

        const swipeDiff = touchstartX - touchendX;
        const swipeAbs = Math.abs(swipeDiff);

        if (swipeAbs > swipeThreshold) {
            // No need to add swiping class here, navigateCard will do it.
            if (swipeDiff > 0) { // Swiped left
                navigateCard('next', true);
            } else { // Swiped right
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
        // If auto-advance is on and you want it to pause/reset when a card is flipped,
        // you might clearAutoAdvanceTimer() here and restart it in displayCard if !isFlipped.
        // For now, auto-advance continues independently unless card navigates.
        flashcardElement.classList.toggle('is-flipped');
        isFlipped = !isFlipped;
    }

    function resetCardFlipVisuals() {
        if (isFlipped) {
            flashcardElement.classList.remove('is-flipped');
            isFlipped = false;
        }
    }


    function startAutoAdvanceTimer() {
        clearAutoAdvanceTimer();
        if (autoAdvanceEnabled && autoAdvanceDuration > 0 && currentDeck.length > 0 && currentCardIndex < currentDeck.length -1) {
            autoAdvanceTimerId = setTimeout(() => {
                // Check autoAdvanceEnabled again in case it was disabled during the timeout
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
        // Prev/Next button states are managed by updateNavigationStates based on index
        // But if the whole interaction is disabled (e.g. no cards), ensure they are also.
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
        if(noCards && autoAdvanceToggle.checked) { // If no cards, ensure toggle is off
            autoAdvanceToggle.checked = false;
            autoAdvanceEnabled = false; // Reflect state
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
    const flashcardElement = document.getElementById('interactiveCard'); // Ensure this is defined for flipCardVisuals/resetCardFlipVisuals
    enableModeButtons(false);
    updateAutoAdvanceUIDisabledState();
    resetDeckForNewMode();
});
