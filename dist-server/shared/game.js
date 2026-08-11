export const ALPHABETS = {
    es: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split(''),
    ca: 'ABCÇDEFGHIJKLMNOPQRSTUVXYZ'.split(''),
};
const ACCENTS = {
    A: 'AÁÀ', E: 'EÉÈ', I: 'IÍÏ', O: 'OÓÒ', U: 'UÚÜ',
};
export function normalizeGuess(value, language) {
    if (typeof value !== 'string' || [...value].length !== 1)
        return null;
    const letter = value.toLocaleUpperCase(language);
    const normalized = Object.entries(ACCENTS).find(([, variants]) => variants.includes(letter))?.[0] ?? letter;
    return ALPHABETS[language].includes(normalized) ? normalized : null;
}
export function isCorrectGuess(word, guess, language) {
    return [...word].some((character) => normalizeGuess(character, language) === guess);
}
export function displayWord(word, guesses, language, reveal = false) {
    return [...word].map((character) => {
        const normalized = normalizeGuess(character, language);
        return normalized === null || reveal || guesses.has(normalized) ? character : '_';
    });
}
export function isWordComplete(word, guesses, language) {
    return !displayWord(word, guesses, language).includes('_');
}
export function validateSecretWord(input, language) {
    if (typeof input !== 'string')
        return null;
    const word = input.trim().replace(/\s+/g, ' ').toLocaleUpperCase(language);
    if (!word || word.length > 50)
        return null;
    const punctuation = new Set([' ', "'", '’', '-', '·']);
    if (![...word].every((character) => normalizeGuess(character, language) !== null || punctuation.has(character)))
        return null;
    return [...word].some((character) => normalizeGuess(character, language) !== null) ? word : null;
}
