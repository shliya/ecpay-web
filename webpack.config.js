const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    mode: 'production', // 1. 改為 production
    cache: false, // 禁用緩存
    entry: {
        index: path.resolve(__dirname, 'app/index.js'),
        login: path.resolve(__dirname, 'app/login.js'),
        ecpaySettings: path.resolve(__dirname, 'app/ecpay-setting.js'),
        event: path.resolve(__dirname, 'app/event.js'),
        eventList: path.resolve(__dirname, 'app/event-list.js'),
        donateList: path.resolve(__dirname, 'app/donate-list.js'),
        ichibanClient: path.resolve(__dirname, 'app/ichiban-client.js'),
        ichiban: path.resolve(__dirname, 'app/ichiban.js'),
        viewerDonate: path.resolve(__dirname, 'app/viewer-donate.js'),
        donateTheme: path.resolve(__dirname, 'app/donate-theme.js'),
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
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'images/[name].[contenthash][ext]',
                },
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
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'app/templates/event-list.html'),
            filename: 'event-list.html',
            chunks: ['eventList'],
            inject: true,
            scriptLoading: 'defer',
            minify: {
                removeComments: true,
                collapseWhitespace: true,
            },
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'app/templates/donate-list.html'),
            filename: 'donate-list.html',
            chunks: ['donateList'],
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
                'app/templates/ichiban-client.html'
            ),
            filename: 'ichiban-client.html',
            chunks: ['ichibanClient'],
            inject: true,
            scriptLoading: 'defer',
            minify: {
                removeComments: true,
                collapseWhitespace: true,
            },
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'app/templates/ichiban.html'),
            filename: 'ichiban.html',
            chunks: ['ichiban'],
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
                'app/templates/viewer-donate.html'
            ),
            filename: 'viewer-donate.html',
            chunks: ['viewerDonate'],
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
                'app/templates/donate-theme.html'
            ),
            filename: 'donate-theme.html',
            chunks: ['donateTheme'],
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
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
                },
            },
        },
    },
    performance: {
        hints: 'warning',
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
    },
};
