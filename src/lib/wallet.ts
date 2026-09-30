import type { WalletChain, WalletSignatureScheme } from '@/types';
import bs58 from 'bs58';

export interface ConnectedWallet {
  address: string;
  scheme: WalletSignatureScheme;
  sign(message: string): Promise<string>;
  disconnect?(): Promise<void>;
}

interface EthereumProvider {
  request(input: { method: string; params?: unknown[] }): Promise<unknown>;
}

interface SolanaProvider {
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, encoding: 'utf8'): Promise<{ signature: Uint8Array }>;
}

interface WalletConnectSession {
  namespaces?: Record<string, { accounts?: unknown }>;
}

export interface WalletConnectConnector {
  connect(params: { namespaces: Record<string, { methods: string[]; chains: string[]; events: string[] }> }): Promise<{ session: WalletConnectSession }>;
  request(params: { method: string; params?: unknown[] | Record<string, unknown> }, chain: string): Promise<unknown>;
  disconnect(): Promise<void>;
}

const WALLET_CAIP2: Record<WalletChain, string> = {
  ethereum: 'eip155:1',
  bsc: 'eip155:56',
  polygon: 'eip155:137',
  solana: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  arbitrum: 'eip155:42161',
  optimism: 'eip155:10',
  base: 'eip155:8453',
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function hexToBytes(value: string): Uint8Array {
  if (!/^0x[0-9a-fA-F]{130}$/.test(value)) throw new Error('지갑이 올바르지 않은 서명을 반환했습니다.');
  return Uint8Array.from(value.slice(2).match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16));
}

function utf8Hex(value: string): string {
  return `0x${Array.from(new TextEncoder().encode(value), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

function walletConnectAccount(session: WalletConnectSession, namespace: string, caip2Network: string): string {
  const accounts = session.namespaces?.[namespace]?.accounts;
  if (!Array.isArray(accounts)) throw new Error('WalletConnect가 선택한 네트워크의 계정을 반환하지 않았습니다.');
  const prefix = `${caip2Network}:`;
  const account = accounts.find(value => typeof value === 'string' && value.startsWith(prefix));
  if (typeof account !== 'string' || account.length <= prefix.length) throw new Error('WalletConnect 계정이 선택한 네트워크와 일치하지 않습니다.');
  return account.slice(prefix.length);
}

function solanaSignatureBytes(value: unknown): Uint8Array {
  if (!value || typeof value !== 'object' || !('signature' in value) || typeof value.signature !== 'string') {
    throw new Error('WalletConnect 지갑이 Solana 서명을 반환하지 않았습니다.');
  }
  let signature: Uint8Array;
  try {
    signature = bs58.decode(value.signature);
  } catch {
    throw new Error('WalletConnect 지갑이 올바르지 않은 Solana 서명을 반환했습니다.');
  }
  if (signature.length !== 64) throw new Error('WalletConnect 지갑이 올바르지 않은 Solana 서명을 반환했습니다.');
  return signature;
}

export function isSolanaChain(chain: WalletChain): boolean {
  return chain === 'solana';
}

export function isWalletConnectConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim());
}

export async function connectWalletConnectWithConnector(
  chain: WalletChain,
  caip2Network: string,
  connector: WalletConnectConnector,
): Promise<ConnectedWallet> {
  if (WALLET_CAIP2[chain] !== caip2Network) throw new Error('선택한 체인과 WalletConnect 네트워크가 일치하지 않습니다.');
  const solanaChain = isSolanaChain(chain);
  const namespace = solanaChain ? 'solana' : 'eip155';
  const method = solanaChain ? 'solana_signMessage' : 'personal_sign';
  let sessionEstablished = false;
  let address: string;
  try {
    const { session } = await connector.connect({
      namespaces: { [namespace]: { methods: [method], chains: [caip2Network], events: ['accountsChanged'] } },
    });
    sessionEstablished = true;
    address = walletConnectAccount(session, namespace, caip2Network);
  } catch (error) {
    if (sessionEstablished) await connector.disconnect().catch(() => undefined);
    throw error;
  }
  return {
    address,
    scheme: solanaChain ? 'solana_ed25519' : 'eip191_personal_sign',
    sign: async message => {
      if (solanaChain) {
        const result = await connector.request({
          method,
          params: { message: bs58.encode(new TextEncoder().encode(message)), pubkey: address },
        }, caip2Network);
        return bytesToBase64(solanaSignatureBytes(result));
      }
      const signature = await connector.request({ method, params: [utf8Hex(message), address] }, caip2Network);
      if (typeof signature !== 'string') throw new Error('WalletConnect 지갑이 서명을 반환하지 않았습니다.');
      return bytesToBase64(hexToBytes(signature));
    },
    disconnect: () => connector.disconnect(),
  };
}

export async function connectWalletConnect(chain: WalletChain, caip2Network: string): Promise<ConnectedWallet> {
  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim();
  if (!projectId) throw new Error('WalletConnect QR 연결이 구성되지 않았습니다.');
  const [{ UniversalConnector }, networks] = await Promise.all([
    import('@reown/appkit-universal-connector'),
    import('@reown/appkit/networks'),
  ]);
  const evmNetworks = [networks.mainnet, networks.bsc, networks.polygon, networks.arbitrum, networks.optimism, networks.base]
    .map(network => ({ ...network, chainNamespace: 'eip155' as const, caipNetworkId: `eip155:${network.id}` as const }));
  const connector = await UniversalConnector.init({
    projectId,
    metadata: {
      name: 'TraceVault',
      description: 'TraceVault wallet ownership verification',
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.ico`],
    },
    networks: [
      {
        namespace: 'eip155',
        methods: ['personal_sign'],
        events: ['accountsChanged'],
        chains: evmNetworks,
      },
      {
        namespace: 'solana',
        methods: ['solana_signMessage'],
        events: ['accountsChanged'],
        chains: [networks.solana],
      },
    ],
    modalConfig: { features: { analytics: false, email: false, socials: [] } },
  });
  return connectWalletConnectWithConnector(chain, caip2Network, connector);
}

export async function connectInjectedWallet(chain: WalletChain): Promise<ConnectedWallet> {
  if (isSolanaChain(chain)) {
    const provider = (window as unknown as { solana?: SolanaProvider }).solana;
    if (!provider) throw new Error('Phantom 호환 지갑을 찾을 수 없습니다. 지갑을 설치하거나 읽기 전용 주소를 사용해 주세요.');
    const connected = await provider.connect();
    const address = connected.publicKey.toString();
    return {
      address,
      scheme: 'solana_ed25519',
      sign: async message => bytesToBase64((await provider.signMessage(new TextEncoder().encode(message), 'utf8')).signature),
    };
  }

  const provider = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  if (!provider) throw new Error('MetaMask 호환 지갑을 찾을 수 없습니다. 지갑을 설치하거나 읽기 전용 주소를 사용해 주세요.');
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!Array.isArray(accounts) || typeof accounts[0] !== 'string') throw new Error('지갑 주소를 가져오지 못했습니다.');
  const address = accounts[0];
  return {
    address,
    scheme: 'eip191_personal_sign',
    sign: async message => {
      const signature = await provider.request({ method: 'personal_sign', params: [utf8Hex(message), address] });
      if (typeof signature !== 'string') throw new Error('지갑이 서명을 반환하지 않았습니다.');
      return bytesToBase64(hexToBytes(signature));
    },
  };
}
