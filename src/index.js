const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const killPort = require('kill-port');
const { ethers } = require('ethers');

require('dotenv').config();

// Public WETH contract on Ethereum mainnet
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const WETH_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
];
const ETH_RPC_URL = process.env.ETH_RPC_URL || 'https://ethereum.publicnode.com';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

const checkPort = async (port, maxPort = 65535) => {

    if (port > maxPort) {
        throw new Error("No available ports found");
    }

    try {
        await killPort(port, "tcp");
        await killPort(port, "udp");
        return port;
    } catch (err) {
        return checkPort(port + 1, maxPort);
    }
};

(async () => {
    const safePort = await checkPort(PORT);
    const getPort = (await import('get-port')).default; // dynamic import
    const final_port = await getPort({ port: safePort });

    console.log(`Port ${final_port} is free. Ready to start server.`);

    // Middleware
    app.use(cors({ origin: `http://localhost:${final_port}` }));
    app.use(express.json());
    app.use(morgan('dev'));

    // Routes
    app.use('/api/items', require('./routes/items'));
    app.use('/api/stats', require('./routes/stats'));

    /**
     * @route    GET /api/netfruxapitest
     * @desc     Fetches name, symbol, decimals, and totalSupply from the public WETH contract
     * @author   Netfrux
     * @access   public
     * @param    {Request}  req  - Express request object
     * @param    {Response} res  - Express response object
     * @returns  {JSON}          Contract metadata and total supply
     * @throws   500 on RPC or contract read failure
     *
     * @example
     * // Example request
     * curl http://localhost:3001/api/netfruxapitest
     *
     * // Example response
     * {
     *   "message": "Contract data fetched successfully",
     *   "data": {
     *     "contract": "WETH (Wrapped Ether)",
     *     "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
     *     "name": "Wrapped Ether",
     *     "symbol": "WETH",
     *     "decimals": 18,
     *     "totalSupply": "..."
     *   }
     * }
     */
    app.get('/api/netfruxapitest', async (req, res) => {
        try {
            const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
            const contract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, provider);

            const [name, symbol, decimals, totalSupply] = await Promise.all([
                contract.name(),
                contract.symbol(),
                contract.decimals(),
                contract.totalSupply(),
            ]);

            const data = {
                contract: 'WETH (Wrapped Ether)',
                address: WETH_ADDRESS,
                name,
                symbol,
                decimals: Number(decimals),
                totalSupply: ethers.formatUnits(totalSupply, decimals),
                network: 'ethereum-mainnet',
            };

            console.log('netfruxapitest — contract data fetched successfully:');
            console.log(data);

            res.json({
                message: 'Contract data fetched successfully',
                data,
            });
        } catch (err) {
            console.error('netfruxapitest failed:', err.message);
            res.status(500).json({
                error: 'Failed to fetch contract data',
                details: err.message,
            });
        }
    });

    require('./config/dbHandler.js').connect();

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
        app.use(express.static('client/build'));
        app.get('*', (req, res) => {
            res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
        });
    }

    // Start server
    app.listen(final_port, () => {
        console.log(`Backend running on http://localhost:${final_port}`);
    });
})();