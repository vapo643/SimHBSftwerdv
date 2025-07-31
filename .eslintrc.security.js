module.exports = {
  extends: ['./.eslintrc.js'],
  plugins: ['security'],
  rules: {
    // Security plugin rules
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-object-injection': 'warn',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    
    // Additional security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-with': 'error',
    
    // React specific security
    'react/no-danger': 'error',
    'react/no-danger-with-children': 'error',
    
    // Prevent XSS
    'react/jsx-no-script-url': 'error',
    'react/jsx-no-target-blank': ['error', { enforceDynamicLinks: 'always' }],
  },
};