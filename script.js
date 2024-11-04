// Grundlegende Variablen
let vocabulary = [];
let unusedVocabulary = [];
let usedVocabulary = [];
let currentWord = null;
let isGermanToEnglish = true;
let totalAttempts = 0;
let correctAnswers = 0;
let wrongAnswers = 0;
let isLoading = true;

// Funktion zum Parsen der RTF-Datei
function parseRTFContent(content) {
    const words = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        // Format: "german - english[phonetic]"
        const parts = line.split(' - ');
        if (parts.length !== 2) continue;
        
        const german = parts[0].trim();
        // Extrahiere English und Phonetic aus dem zweiten Teil
        const match = parts[1].match(/(.+?)\[(.*?)\]/);
        if (!match) continue;
        
        const english = match[1].trim();
        const phonetic = match[2].trim();
        
        words.push({
            german,
            english,
            phonetic,
            correct_count: 0,
            attempts: 0
        });
    }
    return words;
}

// App initialisieren
async function initializeApp() {
    try {
        showLoadingState(true);
        
        // Lade gespeicherte Daten aus dem localStorage
        loadProgress();
        
        // Wenn keine gespeicherten Daten vorhanden sind, lade die RTF-Datei
        if (vocabulary.length === 0) {
            console.log('Lade Vokabeldatei...');
            const response = await fetch('Vokabeln.rtf');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const content = await response.text();
            
            console.log('Initialisiere Vokabeln...');
            vocabulary = parseRTFContent(content);
            unusedVocabulary = [...vocabulary];
            usedVocabulary = [];
            console.log('Vokabeln initialisiert:', vocabulary.length);
        }
        
        if (vocabulary.length === 0) {
            throw new Error('Keine Vokabeln gefunden');
        }
        
        updateStatistics();
        updateProgress();
        
        // Setze isLoading auf false bevor nextWord aufgerufen wird
        isLoading = false;
        showLoadingState(false);
        
        console.log('Wähle erstes Wort...');
        nextWord();
    } catch (error) {
        console.error('Fehler beim Initialisieren:', error);
        let errorMessage = 'Fehler beim Laden der Vokabeln: ';
        if (error.message.includes('HTTP error')) {
            errorMessage += 'Die Datei konnte nicht gefunden werden.';
        } else if (error.message.includes('Keine Vokabeln')) {
            errorMessage += 'Keine Vokabeln in der Datei gefunden.';
        } else {
            errorMessage += error.message;
        }
        showError(errorMessage);
        isLoading = false;
        showLoadingState(false);
    }
}

// Lade- und Fehlerzustand anzeigen
function showLoadingState(show) {
    const elements = document.querySelectorAll('button, input');
    elements.forEach(el => el.disabled = show);
    
    let loadingIndicator = document.getElementById('loadingIndicator');
    if (!loadingIndicator && show) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loadingIndicator';
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.textContent = 'Lade...';
        document.querySelector('.card').prepend(loadingIndicator);
    }
    
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'block' : 'none';
        if (!show) {
            loadingIndicator.remove();
        }
    }
}

function showError(message) {
    // Entferne vorhandene Fehlermeldungen
    const existingErrors = document.querySelectorAll('.error-message');
    existingErrors.forEach(error => error.remove());
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const container = document.querySelector('.card');
    container.prepend(errorDiv);
    
    setTimeout(() => {
        errorDiv.classList.add('fade-out');
        setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
}

// Fortschritt aus localStorage laden
function loadProgress() {
    try {
        const savedData = localStorage.getItem('vocabularyProgress');
        if (savedData) {
            const data = JSON.parse(savedData);
            vocabulary = data.words || [];
            unusedVocabulary = data.unusedVocabulary || [...vocabulary];
            usedVocabulary = data.usedVocabulary || [];
            totalAttempts = data.statistics?.totalAttempts || 0;
            correctAnswers = data.statistics?.correctAnswers || 0;
            wrongAnswers = data.statistics?.wrongAnswers || 0;
            updateStatistics();
        }
    } catch (error) {
        console.error('Fehler beim Laden des Fortschritts:', error);
        showError('Fehler beim Laden des Fortschritts. Die Daten wurden zurückgesetzt.');
        resetStatistics();
    }
}

// Fortschritt im localStorage speichern
function saveProgress() {
    try {
        const data = {
            words: vocabulary,
            unusedVocabulary: unusedVocabulary,
            usedVocabulary: usedVocabulary,
            statistics: {
                totalAttempts,
                correctAnswers,
                wrongAnswers
            }
        };
        localStorage.setItem('vocabularyProgress', JSON.stringify(data));
    } catch (error) {
        console.error('Fehler beim Speichern des Fortschritts:', error);
        showError('Fehler beim Speichern des Fortschritts.');
    }
}

// Fortschritt exportieren
function exportVocabulary() {
    try {
        saveProgress();
    } catch (error) {
        console.error('Fehler beim Exportieren:', error);
        showError('Fehler beim Exportieren der Daten.');
    }
}

// Sprache umschalten
function switchLanguageMode() {
    if (isLoading) return;
    
    isGermanToEnglish = !isGermanToEnglish;
    const instruction = document.getElementById('instruction');
    const inputField = document.getElementById('userInput');
    
    if (isGermanToEnglish) {
        instruction.textContent = "Übersetze das folgende Wort ins Englische:";
        inputField.placeholder = "Englische Übersetzung";
    } else {
        instruction.textContent = "Übersetze das folgende Wort ins Deutsche:";
        inputField.placeholder = "Deutsche Übersetzung";
    }
    
    nextWord();
}

// Popup für Nachrichten anzeigen
function showPopup(message, isCorrect = null) {
    if (isCorrect === true) {
        const popup = document.getElementById('correctPopup');
        document.getElementById('correctWord').textContent = message;
        document.getElementById('pronunciation').textContent = currentWord.phonetic;
        
        popup.style.display = 'flex';
        popup.classList.add('active');
        
        setTimeout(() => {
            popup.classList.remove('active');
            setTimeout(() => {
                popup.style.display = 'none';
            }, 300);
        }, 2000);
    } else if (isCorrect === false) {
        const popup = document.getElementById('wrongPopup');
        document.getElementById('wrongWord').textContent = message;
        
        popup.style.display = 'flex';
        popup.classList.add('active');
        
        setTimeout(() => {
            popup.classList.remove('active');
            setTimeout(() => {
                popup.style.display = 'none';
            }, 300);
        }, 2000);
    }
}

// Text normalisieren für den Vergleich
function normalizeText(text) {
    return text.toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[.,!?]/g, '');
}

// Nächstes Wort auswählen
function nextWord() {
    console.log('nextWord aufgerufen');
    if (vocabulary.length === 0) {
        console.log('Keine Vokabeln verfügbar');
        return;
    }

    // Wenn keine unbenutzten Vokabeln mehr da sind, setze zurück
    if (unusedVocabulary.length === 0) {
        console.log("Alle Vokabeln wurden einmal verwendet. Starte neue Runde.");
        unusedVocabulary = [...vocabulary];
        usedVocabulary = [];
    }

    // Wähle zufällig eine unbenutzte Vokabel aus
    const randomIndex = Math.floor(Math.random() * unusedVocabulary.length);
    currentWord = unusedVocabulary[randomIndex];
    console.log('Neues Wort ausgewählt:', currentWord);
    
    // Verschiebe die Vokabel von unused zu used
    unusedVocabulary.splice(randomIndex, 1);
    usedVocabulary.push(currentWord);

    // Zeige die Vokabel an
    const wordToShow = isGermanToEnglish ? currentWord.german : currentWord.english;
    console.log('Zeige Wort an:', wordToShow);
    document.getElementById('wordDisplay').textContent = wordToShow;
    document.getElementById('userInput').value = '';

    // Aktualisiere die Fortschrittsanzeige
    updateProgress();
}

// Fortschrittsanzeige aktualisieren
function updateProgress() {
    const totalWords = vocabulary.length;
    const remainingWords = unusedVocabulary.length;
    document.getElementById('progressCount').textContent = 
        `${totalWords - remainingWords}/${totalWords} Wörter dieser Runde`;
}

// Statistiken aktualisieren
function updateStatistics() {
    document.getElementById('totalWords').textContent = vocabulary.length;
    document.getElementById('totalAttempts').textContent = totalAttempts;
    document.getElementById('correctCount').textContent = correctAnswers;
    document.getElementById('wrongCount').textContent = wrongAnswers;

    const totalAnswers = correctAnswers + wrongAnswers;
    if (totalAnswers > 0) {
        const correctPercentage = (correctAnswers / totalAnswers) * 100;
        const wrongPercentage = (wrongAnswers / totalAnswers) * 100;
        
        document.getElementById('correctBar').style.width = correctPercentage + '%';
        document.getElementById('wrongBar').style.width = wrongPercentage + '%';
    }
}

// Statistiken zurücksetzen
function resetStatistics() {
    if (isLoading) return;
    
    totalAttempts = 0;
    correctAnswers = 0;
    wrongAnswers = 0;
    
    vocabulary.forEach(word => {
        word.correct_count = 0;
        word.attempts = 0;
    });
    
    unusedVocabulary = [...vocabulary];
    usedVocabulary = [];
    
    updateStatistics();
    updateProgress();
    saveProgress();
    nextWord();
}

// Event-Listener für Enter-Taste
document.getElementById('userInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && !isLoading) {
        event.preventDefault();
        const userInput = normalizeText(this.value);
        const correctAnswer = normalizeText(isGermanToEnglish ? currentWord.english : currentWord.german);
        const shownWord = isGermanToEnglish ? currentWord.german : currentWord.english;
        
        if (!userInput) {
            showError('Bitte gib eine Antwort ein.');
            return;
        }
        
        totalAttempts++;
        if (userInput === correctAnswer) {
            currentWord.correct_count = (currentWord.correct_count || 0) + 1;
            correctAnswers++;
            showPopup(`${shownWord} = ${correctAnswer}`, true);
            this.value = '';
            nextWord();
        } else {
            wrongAnswers++;
            showPopup(`${shownWord} = ${correctAnswer}`, false);
            this.value = '';
        }
        
        updateStatistics();
        saveProgress();
    }
});

// Event-Listener für Input-Validierung
document.getElementById('userInput').addEventListener('input', function(event) {
    const input = event.target;
    input.value = input.value.replace(/^\s+/g, ''); // Entferne führende Leerzeichen
});

// Starte die App
initializeApp();
