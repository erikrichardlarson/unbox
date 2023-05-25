module.exports = {
    purge: ['./renderer/**/*.js', './renderer/**/*.jsx', './renderer/**/*.ts', './renderer/**/*.tsx', './renderer/**/*.html'],
    darkMode: false,
    theme: {
      extend: {},
    },
    variants: {
      extend: {},
    },
    plugins: [
      require('@tailwindcss/forms')
    ],
  }
  