import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWallet } from '../../hooks/useWallet';
import { WalletService } from '../../services/wallet';

// Mock WalletService
vi.mock('../../services/wallet', () => ({
    WalletService: {
        isInstalled: vi.fn(),
        getPublicKey: vi.fn(),
        getNetwork: vi.fn(),
        watchChanges: vi.fn(),
    },
}));

describe('useWallet hook', () => {
    const mockPublicKey = 'GBTEST...';
    const mockNetwork = 'testnet';

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        // Default mocks
        vi.mocked(WalletService.isInstalled).mockResolvedValue(true);
        vi.mocked(WalletService.getPublicKey).mockResolvedValue(mockPublicKey);
        vi.mocked(WalletService.getNetwork).mockResolvedValue(mockNetwork as any);
        vi.mocked(WalletService.watchChanges).mockReturnValue(() => { });
    });

    it('should initialize with disconnected state', () => {
        const { result } = renderHook(() => useWallet());

        expect(result.current.wallet.connected).toBe(false);
        expect(result.current.wallet.address).toBe(null);
        expect(result.current.isConnecting).toBe(false);
        expect(result.current.error).toBe(null);
    });

    it('should connect successfully', async () => {
        const { result } = renderHook(() => useWallet());

        await act(async () => {
            await result.current.connect();
        });

        expect(result.current.wallet.connected).toBe(true);
        expect(result.current.wallet.address).toBe(mockPublicKey);
        expect(localStorage.getItem('nova_wallet_connected')).toBe('true');
        expect(WalletService.watchChanges).toHaveBeenCalled();
    });

    it('should handle disconnect', async () => {
        const { result } = renderHook(() => useWallet());

        // First connect
        await act(async () => {
            await result.current.connect();
        });

        // Then disconnect
        act(() => {
            result.current.disconnect();
        });

        expect(result.current.wallet.connected).toBe(false);
        expect(result.current.wallet.address).toBe(null);
        expect(localStorage.getItem('nova_wallet_connected')).toBe(null);
    });

    it('should attempt silent reconnect on mount if flag is set', async () => {
        localStorage.setItem('nova_wallet_connected', 'true');

        let result: any;
        await act(async () => {
            result = renderHook(() => useWallet()).result;
        });

        await act(async () => {
            await Promise.resolve(); // wait for init()
        });

        expect(result.current.wallet.connected).toBe(true);
        expect(result.current.wallet.address).toBe(mockPublicKey);
    });

    it('should handle error when Freighter is not installed', async () => {
        vi.mocked(WalletService.isInstalled).mockResolvedValue(false);
        const { result } = renderHook(() => useWallet());

        await act(async () => {
            await result.current.connect();
        });

        expect(result.current.wallet.connected).toBe(false);
        expect(result.current.error).toBe('Freighter wallet is not installed');
    });

    it('should handle changes from watcher', async () => {
        let watchCallback: any;
        vi.mocked(WalletService.watchChanges).mockImplementation((cb: any) => {
            watchCallback = cb;
            return () => { };
        });

        const { result } = renderHook(() => useWallet());

        await act(async () => {
            await result.current.connect();
        });

        const newAddress = 'GBNEW...';
        await act(async () => {
            watchCallback({ address: newAddress, network: 'testnet' });
        });

        expect(result.current.wallet.address).toBe(newAddress);

        await act(async () => {
            watchCallback({ address: newAddress, network: 'public' });
        });

        expect(result.current.wallet.network).toBe('mainnet');
    });

    it('should clean up watcher on unmount', async () => {
        const cleanupWatcher = vi.fn();
        vi.mocked(WalletService.watchChanges).mockReturnValue(cleanupWatcher);

        const { result, unmount } = renderHook(() => useWallet());

        await act(async () => {
            await result.current.connect();
        });

        unmount();

        expect(cleanupWatcher).toHaveBeenCalled();
    });
});
