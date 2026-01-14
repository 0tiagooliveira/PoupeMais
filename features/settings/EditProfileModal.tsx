import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
// Import auth to access the firebase user instance directly
import { auth } from '../../services/firebase';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      setName(currentUser.displayName || '');
      setPhotoURL(currentUser.photoURL || '');
    }
  }, [isOpen, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    try {
      // Use auth.currentUser directly as it correctly implements the firebase.User interface with updateProfile method
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        await firebaseUser.updateProfile({
          displayName: name,
          photoURL: photoURL
        });
        
        addNotification('Perfil atualizado com sucesso!', 'success');
        onClose();
        // Recarrega para garantir que todos os contextos peguem a mudança
        window.location.reload(); 
      } else {
        throw new Error("Usuário não encontrado.");
      }
    } catch (error) {
      console.error(error);
      addNotification('Erro ao atualizar perfil.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar perfil">
      <div className="mb-6 flex flex-col items-center">
        <div className="relative group">
          <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-success/20 p-1 shadow-lg transition-transform group-hover:scale-105">
            <img 
              src={photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
              alt="Preview" 
              className="h-full w-full rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
              }}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white shadow-md">
            <span className="material-symbols-outlined text-sm">photo_camera</span>
          </div>
        </div>
        <p className="mt-3 text-[10px] font-bold text-slate-400">Preview da sua foto</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input 
          label="Nome completo" 
          placeholder="Como quer ser chamado?" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          icon="person"
          className="rounded-2xl"
        />

        <Input 
          label="URL da foto de perfil" 
          placeholder="https://link-da-sua-foto.png" 
          value={photoURL}
          onChange={(e) => setPhotoURL(e.target.value)}
          icon="link"
          className="rounded-2xl"
        />

        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 mb-1 leading-tight">Dica de mestre</p>
          <p className="text-[11px] font-medium text-slate-600 leading-snug">
            Use uma URL de imagem pública do Google Drive, Imgur ou redes sociais para atualizar seu avatar.
          </p>
        </div>

        <div className="mt-2 flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 rounded-2xl font-bold h-12">
            Cancelar
          </Button>
          <Button 
            type="submit" 
            isLoading={loading} 
            className="flex-1 rounded-2xl font-bold h-12 bg-slate-800 hover:bg-slate-900 shadow-lg"
          >
            Salvar alterações
          </Button>
        </div>
      </form>
    </Modal>
  );
};