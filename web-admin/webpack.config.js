const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isDevelopment = !isProduction;

  return {
    // Modo de entrada
    mode: isProduction ? 'production' : 'development',
    
    // Ponto de entrada
    entry: {
      main: './src/index.js'
    },

    // Saída
    output: {
      path: path.resolve(__dirname, 'build'),
      filename: isProduction 
        ? 'static/js/[name].[contenthash:8].js'
        : 'static/js/[name].js',
      chunkFilename: isProduction
        ? 'static/js/[name].[contenthash:8].chunk.js'
        : 'static/js/[name].chunk.js',
      assetModuleFilename: 'static/media/[name].[hash:8][ext]',
      publicPath: '/',
      clean: true
    },

    // Source Maps
    devtool: isProduction ? 'source-map' : 'eval-source-map',

    // Resolução de módulos
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@pages': path.resolve(__dirname, 'src/pages'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@services': path.resolve(__dirname, 'src/services'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@styles': path.resolve(__dirname, 'src/styles'),
        '@assets': path.resolve(__dirname, 'src/assets')
      }
    },

    // Loaders
    module: {
      rules: [
        // JavaScript/JSX
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              cacheCompression: false,
              envName: isProduction ? 'production' : 'development'
            }
          }
        },

        // CSS
        {
          test: /\.css$/,
          use: [
            isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                sourceMap: isDevelopment
              }
            },
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    'tailwindcss',
                    'autoprefixer'
                  ]
                }
              }
            }
          ]
        },

        // Imagens
        {
          test: /\.(png|jpe?g|gif|svg|webp)$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024 // 8kb
            }
          },
          generator: {
            filename: 'static/media/[name].[hash:8][ext]'
          }
        },

        // Fontes
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          type: 'asset/resource',
          generator: {
            filename: 'static/fonts/[name].[hash:8][ext]'
          }
        },

        // Outros arquivos
        {
          test: /\.(txt|xml|pdf)$/,
          type: 'asset/resource',
          generator: {
            filename: 'static/files/[name].[hash:8][ext]'
          }
        }
      ]
    },

    // Plugins
    plugins: [
      // Limpeza do diretório build
      new CleanWebpackPlugin(),

      // Variáveis de ambiente
      new Dotenv({
        path: './.env',
        safe: true,
        allowEmptyValues: true,
        systemvars: true,
        defaults: false
      }),

      // Geração do HTML
      new HtmlWebpackPlugin({
        template: 'public/index.html',
        filename: 'index.html',
        inject: true,
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true
        } : false,
        templateParameters: {
          NODE_ENV: process.env.NODE_ENV || 'development',
          APP_NAME: process.env.REACT_APP_NAME || 'Smart Lock Admin'
        }
      }),

      // Extração de CSS em produção
      ...(isProduction ? [
        new MiniCssExtractPlugin({
          filename: 'static/css/[name].[contenthash:8].css',
          chunkFilename: 'static/css/[name].[contenthash:8].chunk.css'
        })
      ] : []),

      // Cópia de arquivos estáticos
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'public',
            to: '',
            globOptions: {
              ignore: ['**/index.html']
            },
            filter: (resourcePath) => {
              // Ignora arquivos de desenvolvimento
              return !resourcePath.includes('dev-') && 
                     !resourcePath.includes('.map');
            }
          }
        ]
      })
    ],

    // Otimização
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            parse: { ecma: 8 },
            compress: {
              ecma: 5,
              warnings: false,
              comparisons: false,
              inline: 2,
              drop_console: isProduction,
              drop_debugger: isProduction
            },
            mangle: { safari10: true },
            output: {
              ecma: 5,
              comments: false,
              ascii_only: true
            }
          }
        }),
        new CssMinimizerPlugin()
      ],
      
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            reuseExistingChunk: true,
            chunks: 'all'
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            priority: 20,
            chunks: 'all'
          },
          charts: {
            test: /[\\/]node_modules[\\/](recharts|d3)[\\/]/,
            name: 'charts',
            priority: 15,
            chunks: 'all'
          }
        }
      },

      runtimeChunk: {
        name: entrypoint => `runtime-${entrypoint.name}`
      }
    },

    // Configuração do servidor de desenvolvimento
    devServer: {
      static: {
        directory: path.join(__dirname, 'public')
      },
      port: 3000,
      hot: true,
      open: true,
      compress: true,
      historyApiFallback: {
        disableDotRule: true,
        index: '/index.html'
      },
      client: {
        overlay: {
          errors: true,
          warnings: false
        },
        progress: true,
        reconnect: true
      },
      
      // Proxy para API durante desenvolvimento
      proxy: {
        '/api': {
          target: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          logLevel: 'debug'
        },
        '/socket.io': {
          target: process.env.REACT_APP_WS_URL || 'http://localhost:3001',
          changeOrigin: true,
          ws: true
        }
      },

      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
      }
    },

    // Performance
    performance: {
      maxAssetSize: 512000,
      maxEntrypointSize: 512000,
      hints: isProduction ? 'warning' : false
    },

    // Stats
    stats: {
      preset: 'minimal',
      moduleTrace: true,
      errorDetails: true
    }
  };
};