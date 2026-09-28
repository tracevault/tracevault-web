import { afterEach, describe, expect, it, vi } from 'vitest';
import bs58 from 'bs58';
import { connectInjectedWallet, connectWalletConnectWithConnector, type WalletConnectConnector } from '@/lib/wallet';

afterEach(() => vi.unstubAllGlobals());

describe('wallet signing adapters', () => {
  it('binds an EVM personal_sign request to the exact challenge and selected account', async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts') return ['0x1111111111111111111111111111111111111111'];
      return `0x${'00'.repeat(65)}`;
    });
    vi.stubGlobal('window', { ethereum: { request } });
    const wallet = await connectInjectedWallet('base');
    expect(wallet.address).toBe('0x1111111111111111111111111111111111111111');
    expect(wallet.scheme).toBe('eip191_personal_sign');
    expect(await wallet.sign('서명 원문')).toBe(`${'A'.repeat(87)}=`);
    expect(request).toHaveBeenLastCalledWith({ method: 'personal_sign', params: ['0xec849cebaa8520ec9b90ebacb8', wallet.address] });
  });

  it('signs the exact UTF-8 challenge with a Solana provider', async () => {
    const signMessage = vi.fn(async (message: Uint8Array) => ({ signature: new Uint8Array(64).fill(1), message }));
    vi.stubGlobal('window', { solana: { connect: async () => ({ publicKey: { toString: () => '11111111111111111111111111111111' } }), signMessage } });
    const wallet = await connectInjectedWallet('solana');
    const signature = await wallet.sign('challenge');
    expect(wallet.scheme).toBe('solana_ed25519');
    expect(signature).toBe('AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ==');
    expect(new TextDecoder().decode(signMessage.mock.calls[0][0])).toBe('challenge');
  });

  it('fails closed when the selected wallet family is unavailable', async () => {
    vi.stubGlobal('window', {});
    await expect(connectInjectedWallet('ethereum')).rejects.toThrow('MetaMask');
    await expect(connectInjectedWallet('solana')).rejects.toThrow('Phantom');
  });

  it('uses the selected EVM CAIP account and converts a WalletConnect personal signature', async () => {
    const request = vi.fn().mockResolvedValue(`0x${'ab'.repeat(65)}`);
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const connector: WalletConnectConnector = {
      connect: vi.fn().mockResolvedValue({ session: { namespaces: { eip155: { accounts: ['eip155:1:0x1111111111111111111111111111111111111111'] } } } }),
      request,
      disconnect,
    };
    const wallet = await connectWalletConnectWithConnector('ethereum', 'eip155:1', connector);
    expect(wallet.address).toBe('0x1111111111111111111111111111111111111111');
    expect(wallet.scheme).toBe('eip191_personal_sign');
    expect(connector.connect).toHaveBeenCalledWith({ namespaces: { eip155: { methods: ['personal_sign'], chains: ['eip155:1'], events: ['accountsChanged'] } } });
    expect(await wallet.sign('TraceVault 확인')).toBe(btoa(String.fromCharCode(...new Uint8Array(65).fill(0xab))));
    expect(request).toHaveBeenCalledWith({ method: 'personal_sign', params: ['0x54726163655661756c7420ed9995ec9db8', wallet.address] }, 'eip155:1');
    await wallet.disconnect?.();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('encodes the Solana WalletConnect message and returns canonical base64 bytes', async () => {
    const signature = new Uint8Array(64).fill(7);
    const request = vi.fn().mockResolvedValue({ signature: bs58.encode(signature) });
    const connector: WalletConnectConnector = {
      connect: vi.fn().mockResolvedValue({ session: { namespaces: { solana: { accounts: ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:722RdWmHC5TGXBjTejzNjbc8xEiduVDLqZvoUGz6Xzbp'] } } } }),
      request,
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const wallet = await connectWalletConnectWithConnector('solana', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', connector);
    expect(wallet.scheme).toBe('solana_ed25519');
    expect(await wallet.sign('challenge')).toBe(btoa(String.fromCharCode(...signature)));
    expect(request).toHaveBeenCalledWith({ method: 'solana_signMessage', params: { message: bs58.encode(new TextEncoder().encode('challenge')), pubkey: wallet.address } }, 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
  });

  it('rejects a mismatched network and malformed WalletConnect signatures', async () => {
    const connector: WalletConnectConnector = {
      connect: vi.fn().mockResolvedValue({ session: { namespaces: { solana: { accounts: ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:722RdWmHC5TGXBjTejzNjbc8xEiduVDLqZvoUGz6Xzbp'] } } } }),
      request: vi.fn().mockResolvedValue({ signature: bs58.encode(new Uint8Array(63)) }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    await expect(connectWalletConnectWithConnector('ethereum', 'eip155:137', connector)).rejects.toThrow('네트워크');
    const wallet = await connectWalletConnectWithConnector('solana', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', connector);
    await expect(wallet.sign('challenge')).rejects.toThrow('올바르지 않은 Solana 서명');
  });

  it('disconnects a session that returns an account from the wrong CAIP network', async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const connector: WalletConnectConnector = {
      connect: vi.fn().mockResolvedValue({ session: { namespaces: { eip155: { accounts: ['eip155:137:0x1111111111111111111111111111111111111111'] } } } }),
      request: vi.fn(),
      disconnect,
    };
    await expect(connectWalletConnectWithConnector('ethereum', 'eip155:1', connector)).rejects.toThrow('선택한 네트워크');
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
