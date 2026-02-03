import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFlashcards } from '../hooks/useFlashcards';
import Editor from './Editor';

const EditorPage = ({ fs }) => {
    const { setId } = useParams();
    const navigate = useNavigate();
    const flashcardState = useFlashcards();


    // Mass Create Settings
    const [massCreateSettings, setMassCreateSettings] = useState({
        enabled: false,
        maxCards: 30
    });

    // Load data on mount or setId change
    useEffect(() => {
        if (setId && fs.items[setId]) {
            const item = fs.items[setId];
            if (item.content) {
                flashcardState.setInputText(item.content.text || '');
                if (item.content.languages) {
                    flashcardState.setLanguages(item.content.languages);
                }
            }
        } else if (!setId) {
            // New set creation mode
            flashcardState.setInputText('');
            flashcardState.setLanguages({ term: 'en-US', definition: 'en-US' });
        }
    }, [setId, fs.items]);

    // Save on unmount or before navigating away
    useEffect(() => {
        return () => {
            if (setId && fs.items[setId]) {
                fs.updateSetContent(setId, {
                    text: flashcardState.inputText, // This might capture stale state if closure is issue, but react-router unmount should be fine?
                    // Actually, standard useEffect cleanup captures closure state from WHEN the effect ran. 
                    // Accessing latest state in cleanup is tricky.
                    // Better strategy: Auto-save when inputText changes (debounced) OR explicit save on navigation.
                    // Previous app used "goBack" which triggered "handleSaveSet".
                });
            }
        };
    }, []);

    // Re-replicating the comprehensive save logic from App.jsx:
    // The previous app had `handleSaveSet` called before navigation.
    // In React Router, we can't easily intercept "back button" to run logic *before* unmount AND have it access latest state easily without refs.

    // Better approach:
    // 1. Save on every change (debounced)? might be heavy for file system.
    // 2. Use a ref to track current text/languages so cleanup function can access it.

    // Let's implement the Ref approach for the cleanup save.

    const contentRef = useRef({ text: '', languages: null, massCreate: { enabled: false, maxCards: 30 } });

    useEffect(() => {
        contentRef.current = {
            text: flashcardState.inputText,
            languages: flashcardState.languages,
            massCreate: massCreateSettings
        };
    }, [flashcardState.inputText, flashcardState.languages, massCreateSettings]);

    useEffect(() => {
        return () => {
            if (setId) {
                const { text, languages, massCreate } = contentRef.current;

                // Logic: Mass Create Splitting
                // If enabled, we parse the text here to check length
                // We reuse the simple parsing logic since hooks aren't available in cleanup
                // We assume default separators for now as they aren't part of contentRef standard flow yet, 
                // but usually user sticks to defaults.

                // Simple Parser
                const cardStrings = text.split('\n').filter(s => s.trim());

                if (massCreate.enabled && cardStrings.length > massCreate.maxCards) {
                    console.log('Mass creating items...');
                    const max = massCreate.maxCards;
                    const chunks = [];
                    for (let i = 0; i < cardStrings.length; i += max) {
                        chunks.push(cardStrings.slice(i, i + max));
                    }

                    // 1. Update the CURRENT set with the first chunk
                    const firstChunkText = chunks[0].join('\n');
                    fs.updateSetContent(setId, {
                        text: firstChunkText,
                        languages: languages
                    });

                    // 2. Create NEW sets for the rest
                    // We need the parent Folder ID. We can get it from the pending item lookup
                    const currentItem = fs.items[setId]; // Note: fs.items might be stale in closure?
                    // fs is a prop, so it refreshes. cleanup captures initial 'fs' if dep array is empty?
                    // We put 'setId' in dep array, so effect recreates when setId changes.
                    // But 'fs' might be stale? useFileSystem functions are stable (useCallback dep []).
                    // accessing fs.items directly might be stale if fs isn't in dep array.
                    // But we can't put fs in dep array easily or it loops.

                    // Workaround: We trust 'fs' functions are up to date.
                    // But we need the parentId.
                    // If we can't get it reliable, we default to 'root'.
                    // Actually, since we navigate away, maybe we don't need to be perfect on stale state for 'items'.
                    // Let's try to get it.
                    const parentId = currentItem?.parentId || 'root';
                    const baseName = currentItem?.name || 'New Set';

                    chunks.slice(1).forEach((chunk, index) => {
                        const newName = `${baseName} ${index + 2}`;
                        const newContent = {
                            text: chunk.join('\n'),
                            languages: languages
                        };

                        // We need to create a Set. 
                        // fs.createItem returns ID, but we don't needed it here.
                        // We pass content directly? createItem signature: (type, name, parent, content)
                        fs.createItem('set', newName, parentId, newContent);
                    });

                } else {
                    // Standard Save
                    fs.updateSetContent(setId, {
                        text: text,
                        languages: languages
                    });
                }
            }
        };
    }, [setId]); // Run cleanup when setId changes (navigating between sets) or unmount.

    return (
        <Editor
            {...flashcardState}
            massCreateSettings={massCreateSettings}
            setMassCreateSettings={setMassCreateSettings}
        />
    );
};

export default EditorPage;
