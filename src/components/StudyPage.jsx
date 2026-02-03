import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFlashcards } from '../hooks/useFlashcards';
import Study from './Study';

const StudyPage = ({ fs }) => {
    const { setId } = useParams();
    const flashcardState = useFlashcards();

    useEffect(() => {
        if (setId && fs.items[setId]) {
            const item = fs.items[setId];
            if (item.content) {
                // Determine languages safely
                const langs = item.content.languages || { term: 'en-US', definition: 'en-US' };

                // Hydrate the hook state
                flashcardState.setInputText(item.content.text || '');
                flashcardState.setLanguages(langs);
            }
        }
    }, [setId, fs.items]);

    const item = fs.items[setId];
    if (!item) return <div>Set not found</div>;

    return (
        <Study
            cards={flashcardState.cards}
            images={flashcardState.images}
            languages={flashcardState.languages}
        />
    );
};

export default StudyPage;
