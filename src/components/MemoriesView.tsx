import type { VaultClientData } from '../types/memory';
import { MemoryBookView } from './MemoryBookView';

interface MemoriesViewProps {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onOpenNewMemory: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export function MemoriesView({
  vault,
  onVaultUpdate,
  onOpenNewMemory,
  onToast,
}: MemoriesViewProps) {
  return (
    <MemoryBookView
      vault={vault}
      onVaultUpdate={onVaultUpdate}
      onOpenNewMemory={onOpenNewMemory}
      onToast={onToast}
    />
  );
}
