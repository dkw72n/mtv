const path = require('path');
// const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = {
  mode: 'development',
  devtool: 'cheap-module-eval-source-map',
  entry: './ui.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  resolve: {
    modules: [ path.resolve(__dirname, 'node_modules')],
    extensions: ['.js', '.jsx']
  },
  module: {
    rules : [
        { 
          test: /\.js|jsx$/,
          exclude: /node_modules/, 
          use: {
            loader: 'babel-loader',
            options: {
              presets: [ "@babel/preset-env","@babel/preset-react" ]
            }
          }
        },
        {
          test: /\.css$/,
          use: [
           {
                loader: 'style-loader'
           },
           {
                loader: 'css-loader',
                options: {
                  modules: {
                    mode: 'local',
                    localIdentName: '[name]_[local]',
                    context: path.resolve(__dirname, 'src'),
                  },
                  sourceMap: false,
                  importLoaders: 1
                }
            }
          ]
        }
    ]
  } /*,
  plugins: [
    new BundleAnalyzerPlugin()
  ]*/
};