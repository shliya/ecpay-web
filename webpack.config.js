const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    mode: 'production', // 1. 改為 production
    entry: {
        index: path.resolve(__dirname, 'app/index.js'),
        login: path.resolve(__dirname, 'app/login.js'),
        ecpaySettings: path.resolve(__dirname, 'app/ecpay-setting.js'),
        event: path.resolve(__dirname, 'app/event.js'),
    },
    output: {
        path: path.resolve(__dirname, 'public'),
        filename: '[name].[contenthash].bundle.js',
        publicPath: '/',
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
        ],
    },
    plugins: [
        new CleanWebpackPlugin(),
        new MiniCssExtractPlugin({
            filename: 'css/[name].[contenthash].css',
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'app/templates/index.html'),
            filename: 'index.html',
            chunks: ['index'],
            inject: true,
            scriptLoading: 'defer',
            minify: {
                removeComments: true,
                collapseWhitespace: true,
            },
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'app/templates/login.html'),
            filename: 'login.html',
            chunks: ['login'],
            inject: true,
            scriptLoading: 'defer',
            minify: {
                removeComments: true,
                collapseWhitespace: true,
            },
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(
                __dirname,
                'app/templates/ecpay-setting.html'
            ),
            filename: 'ecpay-setting.html',
            chunks: ['ecpaySettings'],
            inject: true,
            scriptLoading: 'defer',
            minify: {
                removeComments: true,
                collapseWhitespace: true,
            },
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'app/templates/event.html'),
            filename: 'event.html',
            chunks: ['event'],
            inject: true,
            scriptLoading: 'defer',
            minify: {
                removeComments: true,
                collapseWhitespace: true,
            },
            cache: false,
        }),
    ],
    devtool: 'source-map',
    devServer: {
        static: {
            directory: path.join(__dirname, 'public'),
        },
        compress: true,
        port: 9000,
        historyApiFallback: true,
        proxy: {
            context: ['/api'],
            target: 'http://localhost:3001',
            secure: false,
            changeOrigin: true,
        },
        hot: true,
        liveReload: false,
    },
    resolve: {
        extensions: ['.js', '.json', '.css'],
        alias: {
            '@': path.resolve(__dirname, 'app'),
        },
    },
    optimization: {
        runtimeChunk: 'single',
        splitChunks: {
            chunks: 'all',
            name: false,
        },
    },
};
