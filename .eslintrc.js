module.exports = {
    root: true,

    extends: [
        '@react-native',
        'prettier',
    ],

    rules: {
        'react-native/no-inline-styles': 'warn',
        'react-hooks/exhaustive-deps': 'error',
    },
};