module.exports = function(api) {
  // Cache da configuração do Babel
  api.cache(true);

  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    // Presets - configurações predefinidas
    presets: [
      [
        '@babel/preset-env',
        {
          // Configuração de browsers alvo
          targets: isTest ? {
            node: 'current'
          } : {
            browsers: [
              'last 2 versions',
              'not dead',
              'not ie 11',
              'not op_mini all'
            ]
          },
          
          // Usar built-ins conforme necessário
          useBuiltIns: 'usage',
          
          // Versão do core-js
          corejs: {
            version: 3,
            proposals: true
          },
          
          // Módulos ES6
          modules: isTest ? 'commonjs' : false,
          
          // Debug (apenas desenvolvimento)
          debug: isDevelopment && process.env.BABEL_DEBUG === 'true',
          
          // Transformações específicas
          include: [
            '@babel/plugin-proposal-optional-chaining',
            '@babel/plugin-proposal-nullish-coalescing-operator'
          ]
        }
      ],
      [
        '@babel/preset-react',
        {
          // Runtime automático do React 17+
          runtime: 'automatic',
          
          // Development helpers
          development: isDevelopment,
          
          // Import source para debugging
          importSource: isDevelopment ? '@welldone-software/why-did-you-render' : undefined
        }
      ]
    ],

    // Plugins - transformações específicas
    plugins: [
      // Propriedades de classe
      '@babel/plugin-proposal-class-properties',
      
      // Runtime transform para helpers
      [
        '@babel/plugin-transform-runtime',
        {
          corejs: false,
          helpers: true,
          regenerator: true,
          useESModules: !isTest
        }
      ],

      // Plugin para otimizações condicionais
      ...(isProduction ? [
        // Remove console.log em produção
        [
          'babel-plugin-transform-remove-console',
          {
            exclude: ['error', 'warn']
          }
        ]
      ] : []),

      // Plugins para desenvolvimento
      ...(isDevelopment ? [
        // React Refresh para Hot Reload
        'react-refresh/babel'
      ] : []),

      // Plugins para teste
      ...(isTest ? [
        // Dynamic imports para Jest
        '@babel/plugin-syntax-dynamic-import'
      ] : [])
    ],

    // Configurações por ambiente
    env: {
      // Produção
      production: {
        plugins: [
          // Otimizações específicas de produção
          '@babel/plugin-transform-react-constant-elements',
          '@babel/plugin-transform-react-inline-elements'
        ]
      },
      
      // Desenvolvimento  
      development: {
        plugins: [
          // Melhor debugging
          '@babel/plugin-transform-react-jsx-source',
          '@babel/plugin-transform-react-jsx-self'
        ]
      },

      // Testes
      test: {
        plugins: [
          // Suporte completo para ES modules em Jest
          '@babel/plugin-transform-modules-commonjs'
        ]
      }
    },

    // Configurações avançadas
    assumptions: {
      // Assume que propriedades privadas não são acessadas externamente
      privateFieldsAsProperties: true,
      // Assume que não há getters/setters em propriedades privadas
      setPublicClassFields: true
    },

    // Ignorar arquivos específicos
    ignore: [
      // Arquivos de node_modules (exceto alguns específicos)
      /node_modules\/(?!(react-spring|@react-spring))/,
      // Arquivos de build
      /build/,
      // Arquivos de coverage
      /coverage/
    ],

    // Source maps
    sourceMaps: isDevelopment ? 'inline' : true,
    
    // Comentários nos source maps
    retainLines: isDevelopment,

    // Compact output em produção
    compact: isProduction ? 'auto' : false,

    // Configurações de parse
    parserOpts: {
      strictMode: true,
      allowImportExportEverywhere: false,
      allowReturnOutsideFunction: false,
      plugins: [
        'jsx',
        'asyncGenerators',
        'classProperties',
        'decorators-legacy',
        'doExpressions',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'functionBind',
        'functionSent',
        'objectRestSpread',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining'
      ]
    }
  };
};