
import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useProcessing } from '../../../contexts/ProcessingContext';
import { useNotification } from '../../../contexts/NotificationContext';
import { useAuth } from '../../../contexts/AuthContext';

interface VoiceLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcessed: () => void;
}

export const VoiceLaunchModal: React.FC<VoiceLaunchModalProps> = ({ isOpen, onClose, onProcessed }) => {
  const { currentUser } = useAuth();
  const { startProcessing } = useProcessing();
  const { addNotification } = useNotification();
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    let timer: any;
    if (isRecording) {
      timer = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const startRecording = async () => {
    if (!currentUser?.isPro) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], "voice.webm", { type: 'audio/webm' });
        startProcessing('file', file, '');
        onProcessed();
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setIsRecording(true);
    } catch (e) {
      addNotification("Erro ao acessar microfone.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lançamento por Voz">
      <div className="flex flex-col items-center justify-center py-8 gap-8">
        <div className="relative">
          {isRecording && (
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
          )}
          <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={`relative h-24 w-24 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-90 ${isRecording ? 'bg-danger text-white' : 'bg-primary text-white'}`}
          >
            <span className="material-symbols-outlined text-4xl">{isRecording ? 'stop' : 'mic'}</span>
          </button>
        </div>
        
        <div className="text-center space-y-2">
            <p className={`text-lg font-black tracking-tight ${isRecording ? 'text-danger animate-pulse' : 'text-slate-800'}`}>
                {isRecording ? `Gravando... ${recordingTime}s` : 'Toque para começar a falar'}
            </p>
            <p className="text-xs font-medium text-slate-400 max-w-[220px] mx-auto leading-relaxed">
              Ex: "Gastei 45 reais no mercado hoje" ou "Recebi o bônus de 500 reais".
            </p>
        </div>

        {!isRecording && (
            <Button variant="ghost" onClick={onClose} className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                Cancelar
            </Button>
        )}
      </div>
    </Modal>
  );
};
