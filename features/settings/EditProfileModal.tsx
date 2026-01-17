
import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { auth, storage } from '../../services/firebase';

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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      setName(currentUser.displayName || '');
      setPhotoURL(currentUser.photoURL || '');
    }
  }, [isOpen, currentUser]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      addNotification('Sessão expirada. Faça login novamente.', 'error');
      return;
    }
    
    // Validações básicas de arquivo
    if (file.size > 5 * 1024 * 1024) {
      addNotification('A imagem deve ter no máximo 5MB.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      addNotification('Selecione um arquivo de imagem válido.', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(1); // Força 1% para mostrar que começou

    try {
      const fileExtension = file.name.split('.').pop() || 'png';
      const fileName = `profile_${firebaseUser.uid}_${Date.now()}.${fileExtension}`;
      const fileRef = storage.ref().child(`avatars/${firebaseUser.uid}/${fileName}`);
      
      const metadata = { contentType: file.type };
      
      // O uso do objeto File diretamente é geralmente mais estável para o SDK gerenciar o stream
      const uploadTask = fileRef.put(file, metadata);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.max(1, Math.round(progress)));
        },
        (error: any) => {
          console.error("Erro no upload Storage:", error);
          setUploading(false);
          setUploadProgress(0);
          
          let errorMsg = 'Erro no envio da imagem.';
          if (error.code === 'storage/unauthorized') {
            errorMsg = 'Permissão negada no servidor. Verifique as regras de segurança.';
          } else if (error.code === 'storage/retry-limit-exceeded') {
            errorMsg = 'Falha na conexão. Verifique sua internet.';
          }
          
          addNotification(errorMsg, 'error');
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
        async () => {
          try {
            const url = await uploadTask.snapshot.ref.getDownloadURL();
            setPhotoURL(url);
            addNotification('Foto enviada!', 'success', 2000);
          } catch (err) {
            addNotification('Erro ao processar imagem final.', 'error');
          } finally {
            setUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }
      );
    } catch (err) {
      console.error("Erro ao iniciar upload:", err);
      setUploading(false);
      setUploadProgress(0);
      addNotification('Erro ao preparar arquivo.', 'error');
    }
  };

  const handleAvatarClick = () => {
    if (!uploading && !loading) {
      fileInputRef.current?.click();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      addNotification('Usuário não autenticado.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      await firebaseUser.updateProfile({
        displayName: name.trim(),
        photoURL: photoURL
      });
      
      addNotification('Perfil atualizado com sucesso!', 'success', 2000);
      
      setTimeout(() => {
        window.location.reload(); 
      }, 1000);
      
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      addNotification('Erro ao atualizar dados do perfil.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Perfil">
      <div className="mb-8 flex flex-col items-center">
        <div 
          onClick={handleAvatarClick}
          className={`relative group cursor-pointer transition-transform active:scale-95 ${uploading ? 'pointer-events-none' : ''}`}
        >
          <div className={`h-32 w-32 overflow-hidden rounded-full border-4 transition-all duration-300 shadow-xl flex items-center justify-center bg-slate-50
            ${uploading ? 'border-primary' : 'border-white group-hover:border-primary/40'}`}
          >
            {uploading ? (
               <div className="flex flex-col items-center justify-center">
                 <div className="relative h-14 w-14 flex items-center justify-center">
                    <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                        <circle 
                            cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="4" 
                            strokeDasharray={`${uploadProgress}, 100`}
                            className="text-primary transition-all duration-500 stroke-round"
                        />
                    </svg>
                    <span className="text-[12px] font-black text-primary">{uploadProgress}%</span>
                 </div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-1">Enviando</p>
               </div>
            ) : (
              <img 
                src={photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                alt="Foto de Perfil" 
                className={`h-full w-full object-cover transition-opacity ${uploading ? 'opacity-20' : 'group-hover:opacity-80'}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                }}
              />
            )}
            
            {!uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
                 <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
              </div>
            )}
          </div>
          
          <div className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-lg border-2 border-white">
            <span className="material-symbols-outlined text-lg">add_a_photo</span>
          </div>
        </div>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />
        
        <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
          {uploading ? 'Aguarde o processamento...' : 'Clique para alterar a foto'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Input 
          label="Nome de exibição" 
          placeholder="Seu nome" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          icon="person"
          className="rounded-2xl font-bold"
        />

        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-sm">info</span>
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Dica</p>
          </div>
          <p className="text-[11px] font-medium text-slate-500 leading-snug">
            Ao clicar em alterar, seu navegador poderá solicitar acesso à câmera ou galeria de fotos.
          </p>
        </div>

        <div className="mt-2 flex gap-3">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onClose} 
            disabled={loading || uploading}
            className="flex-1 rounded-2xl font-bold h-12"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            isLoading={loading} 
            disabled={uploading || !name.trim()}
            className="flex-1 rounded-2xl font-bold h-12 bg-primary hover:bg-emerald-600 shadow-xl shadow-success/20 text-white"
          >
            Salvar Perfil
          </Button>
        </div>
      </form>
    </Modal>
  );
};
