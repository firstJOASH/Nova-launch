import { useState, useEffect, useCallback, useRef } from 'react';
import { WalletService } from '../services/wallet';
import type { WalletState } from '../types';

const WALLET_CONNECTED_KEY = 'nova_wallet_connected';

export const useWallet = () => {
    const [wallet, setWallet] = useState<WalletState>({
        connected: false,
        address: null,
        network: 'testnet',
    });
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Use a ref to store the current listener cleanup function
    const cleanupRef = useRef<(() => void) | null>(null);

    const disconnect = useCallback(() => {
        setWallet({
            connected: false,
            address: null,
            network: 'testnet',
        });
        localStorage.removeItem(WALLET_CONNECTED_KEY);

        // Remove listener when disconnected
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }
    }, []);

    const updateWalletState = useCallback(async () => {
        try {
            const isInstalled = await WalletService.isInstalled();
            if (!isInstalled) {
                return false;
            }

            const address = await WalletService.getPublicKey();
            const network = await WalletService.getNetwork();

            if (address) {
                setWallet({
                    connected: true,
                    address,
                    network,
                });
                localStorage.setItem(WALLET_CONNECTED_KEY, 'true');
                return true;
            } else {
                disconnect();
                return false;
            }
        } catch (err) {
            console.error('Failed to update wallet state:', err);
            return false;
        }
    }, [disconnect]);

    const setupListeners = useCallback(() => {
        // Clean up existing listener if any
        if (cleanupRef.current) cleanupRef.current();

        cleanupRef.current = WalletService.watchChanges(({ address, network }) => {
            const net = network.toLowerCase().includes('public') ? 'mainnet' : 'testnet';
            if (address) {
                setWallet({
                    connected: true,
                    address,
                    network: net as 'testnet' | 'mainnet',
                });
            } else {
                disconnect();
            }
        });
    }, [disconnect]);

    const connect = useCallback(async () => {
        setIsConnecting(true);
        setError(null);

        try {
            const isInstalled = await WalletService.isInstalled();
            if (!isInstalled) {
                throw new Error('Freighter wallet is not installed');
            }

            const success = await updateWalletState();
            if (success) {
                setupListeners();
            } else {
                throw new Error('User rejected connection or account not found');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to connect wallet');
            disconnect();
        } finally {
            setIsConnecting(false);
        }
    }, [updateWalletState, setupListeners, disconnect]);

    // Initial silent reconnect
    useEffect(() => {
        const wasConnected = localStorage.getItem(WALLET_CONNECTED_KEY) === 'true';

        const init = async () => {
            if (wasConnected) {
                const isInstalled = await WalletService.isInstalled();
                if (isInstalled) {
                    const success = await updateWalletState();
                    if (success) {
                        setupListeners();
                    }
                }
            }
        };

        init();

        // Cleanup on unmount
        return () => {
            if (cleanupRef.current) cleanupRef.current();
        };
    }, [updateWalletState, setupListeners]);

    return {
        wallet,
        connect,
        disconnect,
        isConnecting,
        error,
    };
};
