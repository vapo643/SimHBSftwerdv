/**
 * Vite Plugin for Code Obfuscation - OWASP ASVS V14.2.5
 * 
 * Obfuscates JavaScript code in production builds to prevent
 * reverse engineering and protect business logic.
 */

import { Plugin } from 'vite';
import JavaScriptObfuscator from 'javascript-obfuscator';

export interface ObfuscatorOptions {
  // Control flow flattening makes code harder to understand
  controlFlowFlattening: boolean;
  controlFlowFlatteningThreshold: number;
  
  // Dead code injection adds fake code
  deadCodeInjection: boolean;
  deadCodeInjectionThreshold: number;
  
  // String obfuscation
  stringArray: boolean;
  rotateStringArray: boolean;
  stringArrayEncoding: ('none' | 'base64' | 'rc4')[];
  stringArrayThreshold: number;
  
  // Identifier obfuscation
  identifierNamesGenerator: 'hexadecimal' | 'mangled' | 'mangled-shuffled';
  
  // Other options
  selfDefending: boolean;
  debugProtection: boolean;
  disableConsoleOutput: boolean;
}

const defaultOptions: ObfuscatorOptions = {
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  stringArray: true,
  rotateStringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  identifierNamesGenerator: 'hexadecimal',
  selfDefending: true,
  debugProtection: true,
  disableConsoleOutput: true
};

export function obfuscatorPlugin(options: Partial<ObfuscatorOptions> = {}): Plugin {
  const config = { ...defaultOptions, ...options };
  
  return {
    name: 'vite-plugin-obfuscate',
    
    // Only apply in production builds
    apply: 'build',
    
    // Transform code after other plugins
    enforce: 'post',
    
    // Transform JavaScript/TypeScript files
    transform(code: string, id: string) {
      // Skip non-JS files
      if (!/\.(js|jsx|ts|tsx)$/.test(id)) {
        return null;
      }
      
      // Skip node_modules
      if (id.includes('node_modules')) {
        return null;
      }
      
      // Skip already minified files
      if (id.includes('.min.')) {
        return null;
      }
      
      try {
        const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
          compact: true,
          controlFlowFlattening: config.controlFlowFlattening,
          controlFlowFlatteningThreshold: config.controlFlowFlatteningThreshold,
          deadCodeInjection: config.deadCodeInjection,
          deadCodeInjectionThreshold: config.deadCodeInjectionThreshold,
          debugProtection: config.debugProtection,
          debugProtectionInterval: 0,
          disableConsoleOutput: config.disableConsoleOutput,
          identifierNamesGenerator: config.identifierNamesGenerator,
          log: false,
          numbersToExpressions: true,
          renameGlobals: false,
          rotateStringArray: config.rotateStringArray,
          selfDefending: config.selfDefending,
          shuffleStringArray: true,
          simplify: true,
          splitStrings: true,
          splitStringsChunkLength: 5,
          stringArray: config.stringArray,
          stringArrayEncoding: config.stringArrayEncoding,
          stringArrayIndexShift: true,
          stringArrayRotate: config.rotateStringArray,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 2,
          stringArrayWrappersChainedCalls: true,
          stringArrayWrappersParametersMaxCount: 4,
          stringArrayWrappersType: 'function',
          stringArrayThreshold: config.stringArrayThreshold,
          unicodeEscapeSequence: true
        });
        
        return {
          code: obfuscationResult.getObfuscatedCode(),
          map: null // Source maps would defeat the purpose
        };
      } catch (error) {
        console.error(`Failed to obfuscate ${id}:`, error);
        return null;
      }
    },
    
    // Additional configuration for production build
    config() {
      return {
        build: {
          // Minify with terser for additional obfuscation
          minify: 'terser',
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
            },
            mangle: {
              toplevel: true,
              properties: {
                regex: /^_/ // Mangle properties starting with underscore
              }
            },
            format: {
              comments: false // Remove all comments
            }
          },
          // Disable source maps in production
          sourcemap: false
        }
      };
    }
  };
}