import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFlashcards } from '../hooks/useFlashcards';
import Editor from './Editor';

const EditorPage = ({ fs, setHasCards }) => {
    const { setId } = useParams();
    const navigate = useNavigate();
    const flashcardState = useFlashcards();
    const [loaded, setLoaded] = useState(false);

    // Mass Create Settings
    const [massCreateSettings, setMassCreateSettings] = useState({
        enabled: false,
        maxCards: 30
    });

    // Update parent about card validity
    useEffect(() => {
        if (setHasCards) {
            setHasCards(flashcardState.cards && flashcardState.cards.length > 0);
        }
    }, [flashcardState.cards, setHasCards]);

    // Load data on mount or setId change
    useEffect(() => {
        if (!loaded && setId && fs.items[setId]) {
            const item = fs.items[setId];
            // Only update if we haven't started editing (which 'loaded' implies)
            // But we also want to handle case where we switch sets.
            // If setId changes, 'loaded' should reset? 
            // We need to reset loaded when setId changes.

            if (item.content) {
                flashcardState.setInputText(item.content.text || '');
                if (item.content.languages) {
                    flashcardState.setLanguages(item.content.languages);
                }
            } else {
                flashcardState.setInputText('');
            }
            setLoaded(true);
        } else if (!setId && !loaded) {
            // New set creation mode
            flashcardState.setInputText('');
            flashcardState.setLanguages({ term: 'en-US', definition: 'en-US' });
            setLoaded(true);
        }
    }, [setId, fs.items, loaded]);
}, [setId, fs.items, loaded, flashcardState.setInputText, flashcardState.setLanguages]); // Added flashcardState setters to dependencies

// Reset loaded state if setId changes
useEffect(() => {
    setLoaded(false);
}, [setId]);

// Keep ref in sync for cleanup
const contentRef = useRef({ text: '', languages: null, loaded: false });
useEffect(() => {
    contentRef.current = {
        text: flashcardState.inputText,
        languages: flashcardState.languages,
        loaded
    };
}, [flashcardState.inputText, flashcardState.languages, loaded]);

// Final Save on Unmount
useEffect(() => {
    return () => {
        if (setId && contentRef.current.loaded) { // Use ref to check loaded state in cleanup
            fs.updateSetContent(setId, {
                text: contentRef.current.text,
                languages: contentRef.current.languages
            });
        }
    };
}, [setId, fs]); // Added fs to dependencies

// Unified Auto-Save Logic
useEffect(() => {
    if (!setId) return;

    const save = () => {
        // Validate: Don't save if it looks like we're overwriting with empty data during load
        // (Wait until loaded is true)
        if (!loaded) return;

        fs.updateSetContent(setId, { text: flashcardState.inputText, languages: flashcardState.languages });
    };

    const timeoutId = setTimeout(save, 500); // More frequent saves (500ms)

    return () => {
        clearTimeout(timeoutId);
        // So for THIS render cycle, the closure has the correct state.
        // We can safely save.
        if (loaded) {
            fs.updateSetContent(setId, {
                text: flashcardState.inputText,
                languages: flashcardState.languages
            });
        }
    };
}, [flashcardState.inputText, flashcardState.languages, setId, loaded]); // Dependencies ensure fresh state

if (!loaded) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: '#888',
            fontSize: '1.2rem',
            flexDirection: 'column',
            gap: '1rem'
        }}>
            <div className="spinner" style={{
                width: '30px',
                height: '30px',
                border: '3px solid #eee',
                borderTop: '3px solid var(--color-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
            }}></div>
            <div>Loading Document...</div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

return (
    <Editor
        {...flashcardState}
        massCreateSettings={massCreateSettings}
        setMassCreateSettings={setMassCreateSettings}
    />
);
};

export default EditorPage;
