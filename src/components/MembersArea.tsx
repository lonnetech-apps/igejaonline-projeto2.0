import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Trash2, Edit, Lock, CheckCircle2, MessageSquare, Calendar, 
  Sparkles, Clock, Settings, Shield, Heart, Smile, Baby, FileText, Send, 
  BookOpen, HelpCircle, ArrowLeft, LogOut, Check, ChevronRight, UserPlus, 
  MapPin, Phone, MessageCircle, X, Church, Eye
} from 'lucide-react';
import { motion } from 'motion/react';
import { Member, Department, PrayerRequest, ChurchSettings, ChurchEvent } from '../types';
import { cn, maskPhone, validateName } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChurchSettingsModal } from './ChurchSettingsModal';
import { EventFormModal } from './EventFormModal';
import { useIsMobile } from '../hooks/useIsMobile';
import { 
  fetchDeptMessagesFromDb, 
  syncAllDeptMessagesToDb,
  saveMemberToDb,
  deleteMemberFromDb,
  saveDepartmentToDb,
  deleteDepartmentFromDb,
  saveDeptMessageToDb,
  deleteDeptMessageFromDb,
  clearAllDeptMessagesFromDb,
  savePrayerRequestToDb,
  deletePrayerRequestFromDb
} from '../lib/firebase';


interface MembersAreaProps {
  currentUser: {
    name: string;
    username: string;
    departments: string[];
    isAdmin: boolean;
    isLeader?: boolean;
  };
  onLogout: () => void;
  churchSettings: ChurchSettings;
  onSaveChurchSettings?: (settings: ChurchSettings) => Promise<void>;
  onClose: () => void;
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  departments: Department[];
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  prayerRequests: PrayerRequest[];
  setPrayerRequests: React.Dispatch<React.SetStateAction<PrayerRequest[]>>;
  events: ChurchEvent[];
  onSaveEvent: (event: Partial<ChurchEvent>) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

interface DepartmentMessage {
  id: string;
  departmentId: string; // Kept for backward compatibility
  departmentIds: string[]; // Added for multi-department association
  senderName: string;
  senderUsername: string;
  text: string;
  date: string;
  expiresAt?: string;
}

export function MembersArea({
  currentUser,
  onLogout,
  churchSettings,
  onSaveChurchSettings,
  onClose,
  members,
  setMembers,
  departments,
  setDepartments,
  prayerRequests,
  setPrayerRequests,
  events,
  onSaveEvent,
  onDeleteEvent,
}: MembersAreaProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'departments' | 'leaders' | 'members' | 'custom_departments'>('departments');
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);

  // States for Member CRUD
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberUsername, setMemberUsername] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberAddress, setMemberAddress] = useState('');
  const [memberBirthDate, setMemberBirthDate] = useState('');
  const [memberPhotoUrl, setMemberPhotoUrl] = useState('');
  const [memberSelectedDepts, setMemberSelectedDepts] = useState<string[]>([]);
  const [memberIsLeader, setMemberIsLeader] = useState(false);
  const [memberIsAdmin, setMemberIsAdmin] = useState(false);
  const [memberError, setMemberError] = useState('');

  // States for Image Cropper
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPanX, setCropPanX] = useState(0);
  const [cropPanY, setCropPanY] = useState(0);
  const [isCropping, setIsCropping] = useState(false);
  const [cropImgNaturalWidth, setCropImgNaturalWidth] = useState(300);
  const [cropImgNaturalHeight, setCropImgNaturalHeight] = useState(300);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  // States for Custom Department CRUD
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [deptError, setDeptError] = useState('');

  // States for Event Management in Leaders department
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<ChurchEvent | null>(null);

  
  const [appDialog, setAppDialog] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: () => {} });

  const showAlert = (message: string) => {
    setAppDialog({ isOpen: true, type: 'alert', title: 'Aviso', message, onConfirm: () => {} });
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setAppDialog({ isOpen: true, type: 'confirm', title: 'Confirmação', message, onConfirm });
  };

  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const lastSyncedDeptMessages = React.useRef<string | null>(null);

  // States for Department Mural
  const [deptMessages, setDeptMessages] = useState<DepartmentMessage[]>(() => {
    const stored = localStorage.getItem('church_dept_messages');
    return stored ? JSON.parse(stored) : [
      {
        id: 'msg1',
        departmentId: 'lideres',
        senderName: 'Pastor Administrador',
        senderUsername: 'admin',
        text: 'Bem-vindos à área de líderes! Aqui podemos planejar nossos próximos cultos.',
        date: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: 'msg2',
        departmentId: 'oracao',
        senderName: 'João Líder',
        senderUsername: 'joao',
        text: 'Lembrete do nosso relógio de oração todas as madrugadas.',
        date: new Date(Date.now() - 3600000 * 24).toISOString(),
      }
    ];
  });

  // Control read message IDs by logged-in user
  const [readMessageIds, setReadMessageIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`church_read_messages_${currentUser.username}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  // Sync when currentUser changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`church_read_messages_${currentUser.username}`);
      setReadMessageIds(stored ? JSON.parse(stored) : []);
    } catch (e) {
      setReadMessageIds([]);
    }
  }, [currentUser.username]);

  // Sync to localStorage on update
  useEffect(() => {
    try {
      localStorage.setItem(`church_read_messages_${currentUser.username}`, JSON.stringify(readMessageIds));
    } catch (e) {}
  }, [readMessageIds, currentUser.username]);

  // Mark department messages as read when department page is entered
  useEffect(() => {
    if (selectedDeptId) {
      const currentDeptMsgs = deptMessages.filter(m => {
        const dIds = m.departmentIds || (m.departmentId ? [m.departmentId] : []);
        const isExpired = m.expiresAt && new Date(m.expiresAt) < new Date();
        return dIds.includes(selectedDeptId) && !isExpired && m.senderUsername !== currentUser.username;
      });

      const unreadIds = currentDeptMsgs
        .map(m => m.id)
        .filter(id => !readMessageIds.includes(id));

      if (unreadIds.length > 0) {
        setReadMessageIds(prev => {
          const next = [...prev];
          unreadIds.forEach(id => {
            if (!next.includes(id)) {
              next.push(id);
            }
          });
          return next;
        });
      }
    }
  }, [selectedDeptId, deptMessages, currentUser.username]);

  // Helper to check for unread messages in a department
  const hasUnreadMessages = (deptId: string) => {
    return deptMessages.some(m => {
      const dIds = m.departmentIds || (m.departmentId ? [m.departmentId] : []);
      const isExpired = m.expiresAt && new Date(m.expiresAt) < new Date();
      const isForDept = dIds.includes(deptId);
      const isNotSelf = m.senderUsername !== currentUser.username;
      const isUnread = !readMessageIds.includes(m.id);
      return isForDept && !isExpired && isNotSelf && isUnread;
    });
  };

  const [newMessageText, setNewMessageText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [messageDuration, setMessageDuration] = useState('always');

  // Synchronize modal states with browser history to support back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (!state || state.modal !== 'members-settings') {
        setIsSettingsModalOpen(false);
      }
      if (!state || state.modal !== 'members-member-view') {
        setViewingMember(null);
      }
      if (!state || state.modal !== 'members-member-form') {
        setIsMemberModalOpen(false);
      }
      if (!state || state.modal !== 'members-dept-form') {
        setIsDeptModalOpen(false);
      }
      if (!state || state.modal !== 'members-event-form') {
        setIsEventModalOpen(false);
      }
      if (!state || state.modal !== 'members-dialog') {
        setAppDialog(prev => ({ ...prev, isOpen: false }));
      }
      if (!state || state.modal !== 'members-dept-detail') {
        setSelectedDeptId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isSettingsModalOpen) {
      if (window.history.state?.modal !== 'members-settings') {
        window.history.pushState({ modal: 'members-settings' }, '');
      }
    } else {
      if (window.history.state?.modal === 'members-settings') {
        window.history.back();
      }
    }
  }, [isSettingsModalOpen]);

  useEffect(() => {
    if (!!viewingMember) {
      if (window.history.state?.modal !== 'members-member-view') {
        window.history.pushState({ modal: 'members-member-view' }, '');
      }
    } else {
      if (window.history.state?.modal === 'members-member-view') {
        window.history.back();
      }
    }
  }, [viewingMember]);

  useEffect(() => {
    if (isMemberModalOpen) {
      if (window.history.state?.modal !== 'members-member-form') {
        window.history.pushState({ modal: 'members-member-form' }, '');
      }
    } else {
      if (window.history.state?.modal === 'members-member-form') {
        window.history.back();
      }
    }
  }, [isMemberModalOpen]);

  useEffect(() => {
    if (isDeptModalOpen) {
      if (window.history.state?.modal !== 'members-dept-form') {
        window.history.pushState({ modal: 'members-dept-form' }, '');
      }
    } else {
      if (window.history.state?.modal === 'members-dept-form') {
        window.history.back();
      }
    }
  }, [isDeptModalOpen]);

  useEffect(() => {
    if (isEventModalOpen) {
      if (window.history.state?.modal !== 'members-event-form') {
        window.history.pushState({ modal: 'members-event-form' }, '');
      }
    } else {
      if (window.history.state?.modal === 'members-event-form') {
        window.history.back();
      }
    }
  }, [isEventModalOpen]);

  useEffect(() => {
    if (appDialog.isOpen) {
      if (window.history.state?.modal !== 'members-dialog') {
        window.history.pushState({ modal: 'members-dialog' }, '');
      }
    } else {
      if (window.history.state?.modal === 'members-dialog') {
        window.history.back();
      }
    }
  }, [appDialog.isOpen]);

  useEffect(() => {
    if (!!selectedDeptId) {
      if (window.history.state?.modal !== 'members-dept-detail') {
        window.history.pushState({ modal: 'members-dept-detail' }, '');
      }
    } else {
      if (window.history.state?.modal === 'members-dept-detail') {
        window.history.back();
      }
    }
  }, [selectedDeptId]);

  // Load messages from Firestore on mount
  useEffect(() => {
    async function loadMessages() {
      try {
        const dbMsgs = await fetchDeptMessagesFromDb();
        if (dbMsgs) {
          setDeptMessages(dbMsgs as any);
          lastSyncedDeptMessages.current = JSON.stringify(dbMsgs);
        } else {
          lastSyncedDeptMessages.current = JSON.stringify(deptMessages);
        }
      } catch (error) {
        console.error("Erro ao carregar mensagens do mural do Firebase:", error);
      } finally {
        setIsDbLoaded(true);
      }
    }
    loadMessages();
  }, []);

  // Save messages to localStorage and Firestore
  useEffect(() => {
    try { localStorage.setItem('church_dept_messages', JSON.stringify(deptMessages)); } catch (e) {  }
    const msgsStr = JSON.stringify(deptMessages);
    if (isDbLoaded && msgsStr !== lastSyncedDeptMessages.current) {
      syncAllDeptMessagesToDb(deptMessages as any);
      lastSyncedDeptMessages.current = msgsStr;
    }
  }, [deptMessages, isDbLoaded]);

  // Determine which departments the logged-in user can access
  // Admin can access ALL departments. Members can only access assigned ones.
  const accessibleDepartments = departments.filter(
    (dept) => currentUser.isAdmin || currentUser.departments.includes(dept.id)
  );

  const selectedDepartment = departments.find((d) => d.id === selectedDeptId);

  // Member CRUD Handlers
  const handleOpenAddMember = (isLeader: boolean) => {
    setViewingMember(null);
    setEditingMember(null);
    setMemberName('');
    
    // Generate a unique 6-digit numeric identifier for the username
    let randomNum = '';
    do {
      randomNum = Math.floor(100000 + Math.random() * 900000).toString();
    } while (members.some(m => m.username === randomNum));

    setMemberUsername(randomNum);
    setMemberPassword('');
    setMemberPhone('');
    setMemberAddress('');
    setMemberBirthDate('');
    setMemberPhotoUrl('');
    setMemberSelectedDepts([]);
    setMemberIsLeader(isLeader);
    setMemberIsAdmin(false);
    setMemberError('');
    setIsMemberModalOpen(true);
  };

  const handleOpenEditMember = (member: Member) => {
    setViewingMember(null);
    setEditingMember(member);
    setMemberName(member.name);
    setMemberUsername(member.username);
    setMemberPassword(member.password || '');
    setMemberPhone(member.phone || '');
    setMemberAddress(member.address || '');
    setMemberBirthDate(member.birthDate || '');
    setMemberPhotoUrl(member.photoUrl || '');
    setMemberSelectedDepts(member.departments || []);
    setMemberIsLeader(member.isLeader || false);
    setMemberIsAdmin(member.isAdmin || false);
    setMemberError('');
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) {
      setMemberError('O nome é obrigatório.');
      return;
    }
    
    // Require username and password for all members
    if (!memberUsername.trim() || !memberPassword.trim()) {
      setMemberError('O identificador (usuário) e a senha de acesso são obrigatórios.');
      return;
    }

    const cleanUsername = memberUsername.trim().toLowerCase();

    // Check if username is taken (excluding editing member)
    const isTaken = (members.some(
      (m) => m.username.toLowerCase() === cleanUsername && m.id !== editingMember?.id
    )) || cleanUsername === 'admin';

    if (isTaken) {
      setMemberError('Este identificador ou nome de usuário já está sendo utilizado.');
      return;
    }

    if (editingMember) {
      // Edit
      const updatedMember: Member = {
        ...editingMember,
        name: memberName.trim(),
        username: cleanUsername,
        password: memberPassword,
        phone: memberPhone.trim(),
        address: memberAddress.trim(),
        birthDate: memberBirthDate.trim(),
        photoUrl: memberPhotoUrl,
        departments: memberSelectedDepts,
        isLeader: memberIsLeader,
        isAdmin: memberIsAdmin
      };
      setMembers(members.map((m) => m.id === editingMember.id ? updatedMember : m));
      await saveMemberToDb(updatedMember);
    } else {
      // Add
      const newMember: Member = {
        id: 'member_' + Date.now(),
        name: memberName.trim(),
        username: cleanUsername,
        password: memberPassword,
        phone: memberPhone.trim(),
        address: memberAddress.trim(),
        birthDate: memberBirthDate.trim(),
        photoUrl: memberPhotoUrl,
        departments: memberSelectedDepts,
        isLeader: memberIsLeader,
        isAdmin: memberIsAdmin,
      };
      setMembers([...members, newMember]);
      await saveMemberToDb(newMember);
    }

    setIsMemberModalOpen(false);
  };

  // Image Cropper Handlers
  const handlePhotoDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDraggingPhoto(true);
    setDragStartPos({
      x: clientX - cropPanX,
      y: clientY - cropPanY
    });
  };

  const handlePhotoDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingPhoto) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setCropPanX(clientX - dragStartPos.x);
    setCropPanY(clientY - dragStartPos.y);
  };

  const handlePhotoDragEnd = () => {
    setIsDraggingPhoto(false);
  };

  const handleConfirmCrop = () => {
    if (!cropImageSrc) return;

    const img = new Image();
    img.onload = () => {
      const canvasSize = 300;
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        const containerSize = 240;
        const aspect = cropImgNaturalWidth / cropImgNaturalHeight;
        let initWidth = containerSize;
        let initHeight = containerSize;
        if (aspect >= 1) {
          initHeight = containerSize;
          initWidth = containerSize * aspect;
        } else {
          initWidth = containerSize;
          initHeight = containerSize / aspect;
        }

        const startX = (containerSize - initWidth) / 2;
        const startY = (containerSize - initHeight) / 2;

        const scaleFactor = canvasSize / containerSize;

        const drawWidth = initWidth * scaleFactor;
        const drawHeight = initHeight * scaleFactor;
        const drawStartX = startX * scaleFactor;
        const drawStartY = startY * scaleFactor;
        const drawPanX = cropPanX * scaleFactor;
        const drawPanY = cropPanY * scaleFactor;

        const imageCenterX = drawStartX + drawPanX + drawWidth / 2;
        const imageCenterY = drawStartY + drawPanY + drawHeight / 2;

        ctx.save();
        ctx.translate(imageCenterX, imageCenterY);
        ctx.scale(cropZoom, cropZoom);
        ctx.translate(-imageCenterX, -imageCenterY);

        ctx.drawImage(
          img,
          drawStartX + drawPanX,
          drawStartY + drawPanY,
          drawWidth,
          drawHeight
        );

        ctx.restore();

        const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
        setMemberPhotoUrl(croppedBase64);
        setIsCropping(false);
        setCropImageSrc(null);
      }
    };
    img.src = cropImageSrc;
  };

  const handleDeleteMember = async (id: string) => {
    showConfirm('Tem certeza de que deseja remover este membro?', async () => {
      setMembers(members.filter((m) => m.id !== id));
      await deleteMemberFromDb(id);
    });
  };

  // Custom Department CRUD Handlers
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || !newDeptDesc.trim()) {
      setDeptError('Nome e descrição são obrigatórios.');
      return;
    }

    const id = newDeptName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/\//g, "_");
    
    // Check if ID already exists
    if (departments.some((d) => d.id === id)) {
      setDeptError('Já existe um departamento com nome similar.');
      return;
    }

    const newDept: Department = {
      id,
      name: newDeptName.trim(),
      description: newDeptDesc.trim(),
      isCustom: true,
      icon: 'users',
    };

    setDepartments([...departments, newDept]);
    await saveDepartmentToDb(newDept);
    setNewDeptName('');
    setNewDeptDesc('');
    setIsDeptModalOpen(false);
    setDeptError('');
  };

  const handleDeleteDept = async (id: string) => {
    if (['criancas', 'jovens', 'homens', 'mulheres', 'lideres', 'oracao'].includes(id)) {
      showAlert('Departamentos padrão não podem ser excluídos.');
      return;
    }
    showConfirm('ATENÇÃO: Tem certeza que deseja remover este departamento permanentemente? Todos os membros perderão acesso a ele.', async () => {
      setDepartments(departments.filter((d) => d.id !== id));
      await deleteDepartmentFromDb(id);
      // Also cleanup users departments
      const updatedMembers = members.map(m => ({
        ...m,
        departments: (m.departments || []).filter(dId => dId !== id)
      }));
      setMembers(updatedMembers);
      for (const m of updatedMembers) {
        await saveMemberToDb(m);
      }
    });
  };

  // Mural Message Handlers
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !selectedDeptId) return;

    let expiresAt: string | undefined = undefined;
    if (messageDuration !== 'always') {
      const days = parseInt(messageDuration, 10);
      if (!isNaN(days)) {
        expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
      }
    }

    const newMsg: DepartmentMessage = {
      id: 'msg_' + Date.now(),
      departmentId: selectedDeptId,
      departmentIds: [selectedDeptId],
      senderName: currentUser.name,
      senderUsername: currentUser.username,
      text: newMessageText.trim(),
      date: new Date().toISOString(),
      expiresAt,
    };

    setDeptMessages([newMsg, ...deptMessages]);
    await saveDeptMessageToDb(newMsg);
    setNewMessageText('');
    setMessageDuration('always');
  };

  const handleDeleteMessage = async (id: string) => {
    const messageToDelete = deptMessages.find(m => m.id === id);
    if (!messageToDelete) {
      console.error("Message not found for deletion:", id);
      return;
    }
    
    // Ensure departmentIds is an array
    const departmentIds = messageToDelete.departmentIds || (messageToDelete.departmentId ? [messageToDelete.departmentId] : []);

    console.log("Delete message called for ID:", id, "Sender:", messageToDelete.senderUsername, "User:", currentUser.username, "isAdmin:", currentUser.isAdmin);

    if (!(currentUser.isAdmin || messageToDelete.senderUsername === currentUser.username)) {
      showAlert("Você não tem permissão para deletar este recado.");
      return;
    }

    showConfirm('Tem certeza de que deseja excluir este recado?', async () => {
      console.log("Proceeding with deletion for message:", id, "Dept:", selectedDeptId);
      
      let messageToUpdate: DepartmentMessage | null = null;
      
      setDeptMessages(prevMessages => {
        let filtered = [...prevMessages];
        if (selectedDeptId && departmentIds.length > 1) {
            // Remove from current department only
            messageToUpdate = {
                ...messageToDelete,
                departmentIds: departmentIds.filter(dId => dId !== selectedDeptId)
            };
            filtered = prevMessages.map(msg => msg.id === id ? messageToUpdate! : msg);
        } else {
            // Delete completely
            filtered = prevMessages.filter((msg) => msg.id !== id);
        }
        lastSyncedDeptMessages.current = JSON.stringify(filtered);
        return filtered;
      });
      
      try {
        if (messageToUpdate) {
            // Update message in DB with new departmentIds
            await saveDeptMessageToDb(messageToUpdate);
        } else {
            await deleteDeptMessageFromDb(id);
        }
        console.log("Message handled successfully from Firebase:", id);
      } catch (error) {
        console.error("Erro ao deletar/atualizar recado do Firebase:", error);
        // Restore UI (this is tricky with functional updates, might need a ref or dedicated error handling)
        showAlert("Erro ao excluir recado. Tente novamente.");
      }
    });
  };

  const handleClearAllMessages = async () => {
    if (!selectedDeptId) return;
    const deptId = selectedDeptId.trim();
    
    console.log("handleClearAllMessages called for dept:", deptId);
    console.log("CurrentUser:", currentUser);
    console.log("Current deptMessages:", deptMessages);

    // Check permissions
    if (!(currentUser.isAdmin || (currentUser.isLeader && currentUser.departments.includes(deptId)))) {
      console.log("Permission denied for clearing mural");
      showAlert("Você não tem permissão para limpar este mural.");
      return;
    }

    showConfirm('ATENÇÃO: Tem certeza de que deseja deletar TODAS as mensagens deste mural? Esta ação não poderá ser desfeita!', async () => {
      const originalMessages = deptMessages;
      
      const filtered: DepartmentMessage[] = [];
      const updates: DepartmentMessage[] = [];
      
      deptMessages.forEach(msg => {
        const departmentIds = msg.departmentIds || (msg.departmentId ? [msg.departmentId] : []);
        if (departmentIds.includes(deptId)) {
          if (departmentIds.length > 1) {
            const updatedMsg = {
                ...msg,
                departmentIds: departmentIds.filter(id => id !== deptId)
            };
            filtered.push(updatedMsg);
            updates.push(updatedMsg);
          }
          // If length === 1, it will NOT be pushed to filtered (i.e. deleted)
        } else {
          filtered.push(msg);
        }
      });
      
      console.log("Filtered messages:", filtered);
      console.log("Messages to update:", updates);

      setDeptMessages(filtered);
      lastSyncedDeptMessages.current = JSON.stringify(filtered);
      
      try {
        // Update messages in DB
        for (const update of updates) {
            console.log("Updating message in DB:", update.id);
            await saveDeptMessageToDb(update);
        }
        
        // Find messages to delete
        const messagesToDelete = deptMessages.filter(msg => {
            const departmentIds = msg.departmentIds || (msg.departmentId ? [msg.departmentId] : []);
            return departmentIds.includes(deptId) && departmentIds.length === 1;
        });
        
        console.log("Messages to delete:", messagesToDelete);
        
        for (const msg of messagesToDelete) {
            console.log("Deleting message from DB:", msg.id);
            await deleteDeptMessageFromDb(msg.id);
        }
        
        console.log("All mural messages handled successfully for department:", deptId);
      } catch (error) {
        console.error("Erro ao deletar/atualizar todos os recados do Firebase:", error);
        setDeptMessages(originalMessages); // Restore UI
        lastSyncedDeptMessages.current = JSON.stringify(originalMessages);
        showAlert("Erro ao excluir recados. Tente novamente.");
      }
    });
  };

  const handleSaveEditMessage = async (id: string) => {
    if (!editingMessageText.trim()) return;
    let updatedMsg: DepartmentMessage | null = null;
    setDeptMessages(deptMessages.map((msg) => {
      if (msg.id === id) {
        updatedMsg = { ...msg, text: editingMessageText.trim() };
        return updatedMsg;
      }
      return msg;
    }));
    if (updatedMsg) {
      await saveDeptMessageToDb(updatedMsg);
    }
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  // Prayer Request Handlers
  const handleUpdatePrayerStatus = async (id: string, status: 'pending' | 'prayed' | 'answered') => {
    let updatedReq: PrayerRequest | undefined;
    setPrayerRequests(prayerRequests.map(p => {
      if (p.id === id) {
        updatedReq = { ...p, status };
        return updatedReq;
      }
      return p;
    }));
    if (updatedReq) {
      await savePrayerRequestToDb(updatedReq);
    }
  };

  const handleAddPrayerNote = async (id: string, notes: string) => {
    let updatedReq: PrayerRequest | undefined;
    setPrayerRequests(prayerRequests.map(p => {
      if (p.id === id) {
        updatedReq = { ...p, notes };
        return updatedReq;
      }
      return p;
    }));
    if (updatedReq) {
      await savePrayerRequestToDb(updatedReq);
    }
  };

  const handleDeletePrayer = (id: string) => {
    showConfirm(
      "Deseja realmente excluir este pedido de oração? Esta ação não pode ser desfeita.",
      async () => {
        setPrayerRequests(prayerRequests.filter(p => p.id !== id));
        await deletePrayerRequestFromDb(id);
      }
    );
  };

  // Icon Render Helper
  const getDeptIcon = (id: string) => {
    switch (id) {
      case 'criancas': return <Baby className="w-5 h-5" />;
      case 'jovens': return <Sparkles className="w-5 h-5" />;
      case 'homens': return <Shield className="w-5 h-5" />;
      case 'mulheres': return <Heart className="w-5 h-5" />;
      case 'lideres': return <Users className="w-5 h-5" />;
      case 'oracao': return <BookOpen className="w-5 h-5" />;
      default: return <Users className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">

      {appDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-xl font-bold text-slate-800 mb-2">{appDialog.title}</h3>
            <p className="text-slate-600 mb-6">{appDialog.message}</p>
            <div className="flex gap-3 justify-end">
              {appDialog.type === 'confirm' && (
                <button
                  onClick={() => setAppDialog(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={() => {
                  appDialog.onConfirm();
                  setAppDialog(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
              >
                {appDialog.type === 'confirm' ? 'Confirmar' : 'OK'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {churchSettings.logoUrl ? (
                <img 
                  src={churchSettings.logoUrl} 
                  alt="Logo" 
                  className={cn(
                    "w-12 h-12 rounded-lg shrink-0 border border-slate-800 shadow-sm",
                    churchSettings.logoFit === 'contain' ? "object-contain p-0.5 bg-white" : "object-cover"
                  )} 
                />
              ) : (
                <div className="bg-blue-600 p-2.5 rounded-xl text-white shrink-0 shadow-sm">
                  <Church className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">
                  <Shield className="w-4 h-4 text-blue-500" />
                  Área Restrita de Membros
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-serif">
                  {churchSettings.name}
                </h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Olá, <span className="text-white font-bold">{currentUser.name}</span>! Você está logado como {currentUser.isAdmin ? 'Administrador' : 'Membro'}.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {currentUser.isAdmin && (
                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/10"
                >
                  <Settings className="w-4 h-4" />
                  Dados da Igreja
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao Site
              </button>
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-950/40 hover:bg-red-900 text-red-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-red-900/30"
              >
                <LogOut className="w-4 h-4" />
                Sair da Conta
              </button>
            </div>
          </div>
        </div>
      </div>

      <ChurchSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={churchSettings}
        onSave={onSaveChurchSettings || (async () => {})}
      />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {selectedDeptId ? (
          /* ==========================================
             DEPARTMENT DEDICATED PAGE VIEW
             ========================================== */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom duration-300">
            {/* Back to list */}
            <div>
              <button
                onClick={() => setSelectedDeptId(null)}
                className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar aos Departamentos
              </button>
            </div>

            {/* Department Hero */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 opacity-10">
                <Users className="w-96 h-96" />
              </div>
              <div className="relative z-10 flex items-start gap-4">
                <div className="p-4 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md text-white">
                  {getDeptIcon(selectedDeptId)}
                </div>
                <div>
                  <h2 className="text-3xl font-black font-serif tracking-tight">{selectedDepartment?.name}</h2>
                  <p className="text-blue-100 mt-2 max-w-2xl text-sm leading-relaxed">{selectedDepartment?.description}</p>
                </div>
              </div>
            </div>

            {/* Department Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Mural de Recados & Prayer requests if Oração */}
              <div className="lg:col-span-8 space-y-8">
                
                {/* Specific features for Oração: Prayer requests list */}
                {(selectedDeptId === 'oracao') && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                          Gerenciador de Pedidos de Oração
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Pedidos enviados pelo site público para intercessão</p>
                      </div>
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {prayerRequests.length} Total
                      </span>
                    </div>

                    {prayerRequests.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">
                        <FileText className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                        <p className="text-sm font-semibold">Nenhum pedido de oração ativo.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {prayerRequests.map((req, index) => (
                          <div 
                            key={`req-${req.id || index}-${index}`} 
                            className={cn(
                              "border rounded-xl p-5 transition-all space-y-4 relative bg-slate-50/50",
                              req.status === 'answered' ? "border-emerald-200 bg-emerald-50/10" : 
                              req.status === 'prayed' ? "border-blue-200 bg-blue-50/10" : "border-slate-200"
                            )}
                          >
                            <div className="flex flex-wrap justify-between items-start gap-2">
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                  {req.name}
                                  {req.phone && (
                                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                      <Phone className="w-3.5 h-3.5" />
                                      {req.phone}
                                    </span>
                                  )}
                                </h4>
                                <span className="text-[10px] text-slate-400">
                                  Enviado em: {format(new Date(req.date), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                                  req.status === 'answered' ? "bg-emerald-100 text-emerald-800" :
                                  req.status === 'prayed' ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                                )}>
                                  {req.status === 'answered' ? 'Respondido' :
                                   req.status === 'prayed' ? 'Em Oração' : 'Pendente'}
                                </span>
                                {currentUser.isAdmin && (
                                  <button
                                    onClick={() => handleDeletePrayer(req.id)}
                                    title="Excluir pedido de oração"
                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="text-slate-700 text-sm leading-relaxed bg-white border border-slate-100 p-3 rounded-lg italic">
                              "{req.message}"
                            </p>

                            {/* Intercession Notes */}
                            <div className="bg-slate-100/50 p-3 rounded-lg space-y-2">
                              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">Notas de Intercessão / Acompanhamento:</span>
                              {req.notes ? (
                                <p className="text-xs text-slate-700 bg-white p-2 rounded border border-slate-200/50">
                                  {req.notes}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 italic">Nenhuma anotação feita neste pedido.</p>
                              )}
                              
                              <div className="pt-2 flex flex-wrap gap-2">
                                <input
                                  type="text"
                                  maxLength={500}
                                  placeholder="Escrever anotação pastoral..."
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleAddPrayerNote(req.id, (e.target as HTMLInputElement).value);
                                      (e.target as HTMLInputElement).value = '';
                                    }
                                  }}
                                  className="flex-1 text-xs px-2.5 py-1 bg-white border border-slate-200 rounded outline-none focus:border-blue-500"
                                />
                                <button
                                  onClick={(e) => {
                                    const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                    if (input && input.value) {
                                      handleAddPrayerNote(req.id, input.value);
                                      input.value = '';
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors"
                                >
                                  Salvar Nota
                                </button>
                              </div>
                            </div>

                            {/* Status controls */}
                            <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end border-t border-slate-100 pt-3">
                              <button
                                onClick={() => handleUpdatePrayerStatus(req.id, 'pending')}
                                className={cn(
                                  "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer border flex-1 sm:flex-initial text-center justify-center",
                                  req.status === 'pending' ? "bg-amber-100 border-amber-200 text-amber-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                Pendente
                              </button>
                              <button
                                onClick={() => handleUpdatePrayerStatus(req.id, 'prayed')}
                                className={cn(
                                  "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer border flex-1 sm:flex-initial text-center justify-center",
                                  req.status === 'prayed' ? "bg-blue-100 border-blue-200 text-blue-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                Intercedendo
                              </button>
                              <button
                                onClick={() => handleUpdatePrayerStatus(req.id, 'answered')}
                                className={cn(
                                  "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer border flex-1 sm:flex-initial text-center justify-center",
                                  req.status === 'answered' ? "bg-emerald-100 border-emerald-200 text-emerald-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                Respondido!
                              </button>

                              {req.phone && (
                                <a
                                  href={`https://wa.me/${req.phone.replace(/\D/g, '').startsWith('55') && req.phone.replace(/\D/g, '').length >= 12 ? req.phone.replace(/\D/g, '') : '55' + req.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full sm:w-auto sm:ml-auto px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  Chamar no WhatsApp
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}



                {/* Mural de Recados */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                        Mural do Departamento
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Mural interativo para recados, avisos e apoio mútuo</p>
                    </div>
                    {(currentUser.isAdmin || (currentUser.isLeader && currentUser.departments.includes(selectedDeptId || ''))) && (
                      <button
                        onClick={handleClearAllMessages}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Limpar Mural
                      </button>
                    )}
                  </div>

                  {/* Send message form */}
                  {(currentUser.isAdmin || (currentUser.isLeader && currentUser.departments.includes(selectedDeptId || ''))) ? (
                    <form onSubmit={handleSendMessage} className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                      <div className="text-xs font-bold text-slate-700">Novo Recado:</div>
                      <textarea
                        required
                        maxLength={500}
                        rows={3}
                        placeholder="Escreva um recado ou aviso importante para o departamento..."
                        value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        className="w-full px-4 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-white"
                      />
                      <div className="flex flex-wrap gap-3 items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500 font-bold">Exibir por:</span>
                          <select
                            value={messageDuration}
                            onChange={(e) => setMessageDuration(e.target.value)}
                            className="px-2.5 py-1.5 text-[11px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 cursor-pointer text-slate-700 font-bold"
                          >
                            <option value="always">Sempre visível</option>
                            <option value="1">1 dia (24 horas)</option>
                            <option value="3">3 dias</option>
                            <option value="7">7 dias (1 semana)</option>
                            <option value="15">15 dias</option>
                            <option value="30">30 dias</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Enviar Recado
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center text-xs text-slate-500 italic">
                      Apenas líderes e administradores deste departamento podem publicar novos recados no mural.
                    </div>
                  )}

                  {/* Message List */}
                  <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                    {deptMessages.filter(m => {
                      const dIds = m.departmentIds || (m.departmentId ? [m.departmentId] : []);
                      return dIds.includes(selectedDeptId || '');
                    }).length === 0 ? (
                      <div className="text-center py-8 text-slate-400 italic text-xs">
                        Nenhuma mensagem neste mural.
                      </div>
                    ) : (
                      deptMessages
                        .filter(m => {
                          const dIds = m.departmentIds || (m.departmentId ? [m.departmentId] : []);
                          return dIds.includes(selectedDeptId || '');
                        })
                        .map((msg, index) => (
                          <div key={`msg-${msg.id || index}-${index}`} className={`bg-slate-50 rounded-xl p-4 border border-slate-150 flex gap-3 ${msg.expiresAt && new Date(msg.expiresAt) < new Date() ? 'opacity-60' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 uppercase">
                              {msg.senderName.substring(0, 2)}
                            </div>
                            
                            {editingMessageId === msg.id ? (
                              <div className="space-y-3 w-full">
                                <textarea
                                  value={editingMessageText}
                                  maxLength={500}
                                  onChange={(e) => setEditingMessageText(e.target.value)}
                                  rows={3}
                                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-white"
                                />
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMessageId(null);
                                      setEditingMessageText('');
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditMessage(msg.id)}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                                  >
                                    Salvar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-100/70 pb-1.5 mb-1.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-xs text-slate-800">{msg.senderName}</span>
                                    {msg.senderUsername === 'admin' && (
                                      <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded">ADMIN</span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between sm:justify-end gap-2 text-slate-400 w-full sm:w-auto">
                                    <span className="text-[10px]">
                                      {format(new Date(msg.date), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                    </span>
                                    {(currentUser.isAdmin || msg.senderUsername === currentUser.username) && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() => {
                                            setEditingMessageId(msg.id);
                                            setEditingMessageText(msg.text);
                                          }}
                                          className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                          title="Editar"
                                        >
                                          <Edit className="w-3.5 h-3.5 pointer-events-none" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            console.log("Delete button clicked for ID:", msg.id);
                                            handleDeleteMessage(msg.id);
                                          }}
                                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                          title="Deletar"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line break-words">{msg.text}</p>
                                {msg.expiresAt && (
                                  <div className={`flex items-center gap-1 text-[10px] font-bold pt-1.5 ${new Date(msg.expiresAt) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                                    <Clock className="w-3 h-3" />
                                    <span>{new Date(msg.expiresAt) < new Date() ? 'Expirado em' : 'Expira em'}: {format(new Date(msg.expiresAt), "d/MM 'às' HH:mm", { locale: ptBR })}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column: Membros do Departamento */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Users className="w-4 h-4 text-slate-500" />
                    Membros do Departamento
                  </h3>

                  <div className="space-y-3">
                    {/* Admin is always considered present */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center uppercase shrink-0">
                          AD
                        </div>
                        <span className="text-xs font-bold text-slate-800 block truncate">Administrador Master</span>
                      </div>
                      <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider bg-blue-50 px-1.5 py-0.5 rounded shrink-0">Líder</span>
                    </div>

                    {members
                      .filter(m => m.departments.includes(selectedDeptId))
                      .map((member, index) => (
                        <div key={`member-${member.id || index}-${index}`} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <button 
                              onClick={() => setViewingMember(member)}
                              title="Ver Credencial"
                              className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center uppercase shrink-0 cursor-pointer hover:scale-110 active:scale-95 transition-all outline-none"
                            >
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt={member.name} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                member.name.substring(0, 2)
                              )}
                            </button>
                            <span className="text-xs font-bold text-slate-800 block truncate">{member.name}</span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 hidden sm:block">@{member.username}</span>
                        </div>
                      ))}
                    
                    {members.filter(m => m.departments.includes(selectedDeptId)).length === 0 && (
                      <p className="text-xs text-slate-400 italic py-2">Nenhum membro regular vinculado.</p>
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* ==========================================
             MEMBERS AREA HOME / DASHBOARD
             ========================================== */
          <div className="space-y-10">
            {/* Navigation Tabs for admin, simple departments for standard user */}
            {currentUser.isAdmin && (
              <div className="flex items-center border-b border-slate-200 overflow-x-auto no-scrollbar scroll-smooth">
                <div className="flex flex-nowrap min-w-max">
                  <button
                    onClick={() => setActiveTab('departments')}
                    className={cn(
                      "px-5 py-3 text-sm font-bold border-b-2 -mb-[2px] transition-colors cursor-pointer whitespace-nowrap",
                      activeTab === 'departments' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
                    )}
                  >
                    Departamentos ({departments.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('leaders')}
                    className={cn(
                      "px-5 py-3 text-sm font-bold border-b-2 -mb-[2px] transition-colors cursor-pointer whitespace-nowrap",
                      activeTab === 'leaders' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
                    )}
                  >
                    Líderes ({members.filter(m => m.isLeader).length})
                  </button>
                  <button
                    onClick={() => setActiveTab('members')}
                    className={cn(
                      "px-5 py-3 text-sm font-bold border-b-2 -mb-[2px] transition-colors cursor-pointer whitespace-nowrap",
                      activeTab === 'members' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
                    )}
                  >
                    Membros ({members.length})
                  </button>
                </div>
              </div>
            )}

            {/* Content Switch */}
            {activeTab === 'departments' || !currentUser.isAdmin ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 font-serif">Seus Departamentos Autorizados</h2>
                    <p className="text-xs text-slate-500 mt-1">Selecione um departamento para acessar sua página dedicada e mural de recados</p>
                  </div>
                  {currentUser.isAdmin && (
                    <button
                      onClick={() => setIsDeptModalOpen(true)}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/10"
                    >
                      <Plus className="w-4 h-4" />
                      Novo Departamento
                    </button>
                  )}
                </div>

                {accessibleDepartments.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-md mx-auto">
                    <Lock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="font-bold text-slate-800">Sem Departamentos</h3>
                    <p className="text-xs text-slate-500 mt-1">O seu usuário não tem acesso liberado a nenhum departamento ainda. Solicite a liberação de acesso com o administrador!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {accessibleDepartments.map((dept, index) => (
                      <div 
                        key={`dept-card-${dept.id || index}-${index}`}
                        onClick={() => setSelectedDeptId(dept.id)}
                        className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group relative"
                      >
                        <div className="flex items-center justify-between gap-4 w-full">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center shrink-0 relative">
                              {getDeptIcon(dept.id)}
                              {hasUnreadMessages(dept.id) && (
                                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 z-10">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span>
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors text-sm truncate">{dept.name}</h3>
                                {hasUnreadMessages(dept.id) && (
                                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-md uppercase tracking-wider animate-pulse flex items-center gap-0.5 shadow-sm shadow-red-500/15 shrink-0">
                                    <MessageSquare className="w-2.5 h-2.5" />
                                    Novo Recado
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate hidden sm:block">{dept.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {currentUser.isAdmin && dept.isCustom && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDept(dept.id);
                                }}
                                className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                title="Remover Departamento"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                              <span className="hidden sm:inline">Acessar</span>
                              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (activeTab === 'leaders' || activeTab === 'members') && currentUser.isAdmin ? (
              /* ==========================================
                 ADMIN MANAGEMENT TAB
                 ========================================== */
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 font-serif">{activeTab === 'leaders' ? 'Líderes' : 'Membros'}</h2>
                    <p className="text-xs text-slate-500 mt-1">Cadastre e configure {activeTab === 'leaders' ? 'líderes' : 'membros'} da igreja</p>
                  </div>
                  <button
                    onClick={() => handleOpenAddMember(activeTab === 'leaders')}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/10"
                  >
                    <UserPlus className="w-4 h-4" />
                    Novo {activeTab === 'leaders' ? 'Líder' : 'Membro'}
                  </button>
                </div>

                {/* Member Table/Grid */}
                <div className="space-y-4">
                  {/* Cards for mobile */}
                  <div className="grid grid-cols-1 gap-4 sm:hidden">
                    {members.filter(m => activeTab === 'leaders' ? m.isLeader : true).map((m, mIndex) => (
                      <div key={`mobile-member-${m.id || mIndex}-${mIndex}`} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <button 
                            onClick={() => setViewingMember(m)}
                            title="Ver Credencial"
                            className={cn(
                              "w-10 h-10 rounded-full text-sm font-bold flex items-center justify-center uppercase shrink-0 cursor-pointer hover:scale-110 active:scale-95 transition-all outline-none",
                              m.isLeader ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "bg-blue-100 text-blue-700"
                            )}
                          >
                            {m.photoUrl ? (
                              <img src={m.photoUrl} alt={m.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              m.name.substring(0, 2)
                            )}
                          </button>
                          <div className="min-w-0">
                            <span className={cn(
                              "font-bold block truncate text-sm leading-tight mb-0.5",
                              m.isLeader ? "text-blue-600" : "text-slate-900"
                            )}>{m.name}</span>
                            <div className="flex items-center gap-1.5">
                              {m.isLeader && <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter">Líder</span>}
                              {activeTab === 'leaders' && <span className="text-[10px] text-slate-500 truncate bg-slate-100 px-1.5 py-0.5 rounded font-medium">@{m.username}</span>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-end gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setIsMemberModalOpen(false);
                              setViewingMember(m);
                            }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditMember(m)}
                            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(m.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {members.filter(m => activeTab === 'leaders' ? m.isLeader : true).length === 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 italic text-sm">
                        Nenhum {activeTab === 'leaders' ? 'líder' : 'membro'} cadastrado.
                      </div>
                    )}
                  </div>

                  {/* Table for desktop */}
                  <div className="hidden sm:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Nome</th>
                            {activeTab === 'leaders' && (
                                <>
                                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Usuário (Login)</th>
                                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Senha</th>
                                </>
                            )}
                            {activeTab === 'leaders' && <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Departamentos</th>}
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {members.filter(m => activeTab === 'leaders' ? m.isLeader : true).map((m, mIndex) => (
                            <tr key={`table-member-${m.id || mIndex}-${mIndex}`} className="hover:bg-slate-50/50">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => setViewingMember(m)}
                                    title="Ver Credencial"
                                    className={cn(
                                      "w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center uppercase cursor-pointer hover:scale-110 active:scale-95 transition-all outline-none",
                                      m.isLeader ? "bg-blue-600 text-white shadow-sm" : "bg-blue-100 text-blue-700"
                                    )}
                                  >
                                    {m.photoUrl ? (
                                      <img src={m.photoUrl} alt={m.name} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                      m.name.substring(0, 2)
                                    )}
                                  </button>
                                  <div>
                                    <span className={cn(
                                      "font-bold block",
                                      m.isLeader ? "text-blue-600" : "text-slate-900"
                                    )}>{m.name}</span>
                                    {m.isLeader && activeTab === 'members' && <span className="text-[8px] font-bold text-blue-500 uppercase tracking-tighter -mt-0.5 block">Líder</span>}
                                  </div>
                                </div>
                              </td>
                              {activeTab === 'leaders' && (
                                  <>
                                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">@{m.username}</td>
                                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{m.password}</td>
                                  </>
                              )}
                              {activeTab === 'leaders' && (
                                <td className="px-6 py-4">
                                  <div className="flex flex-wrap gap-1">
                                    {m.departments && m.departments.length > 0 ? (
                                      m.departments.map((deptId, index) => {
                                        const d = departments.find(dep => dep.id === deptId);
                                        return (
                                          <span key={`badge-${m.id || 'm'}-${mIndex}-${deptId}-${index}`} className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            {d ? d.name : deptId}
                                          </span>
                                        );
                                      })
                                    ) : (
                                      <span className="text-slate-400 italic text-xs">Nenhum</span>
                                    )}
                                  </div>
                                </td>
                              )}
                              <td className="px-6 py-4 text-right">
                                <div className="inline-flex gap-2">
                                  <button
                                    onClick={() => {
                                      setIsMemberModalOpen(false);
                                      setViewingMember(m);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-100"
                                    title="Visualizar"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditMember(m)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-100"
                                    title="Editar"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMember(m.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-100"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {members.filter(m => activeTab === 'leaders' ? m.isLeader : true).length === 0 && (
                          <tr>
                            <td colSpan={activeTab === 'leaders' ? 5 : 2} className="text-center py-8 text-slate-400 italic">Nenhum {activeTab === 'leaders' ? 'líder' : 'membro'} cadastrado.</td>
                          </tr>
                        )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* MEMBER CREATE/EDIT MODAL */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMemberModalOpen(false)} />
          <div className={`bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 flex flex-col max-h-[90vh] ${isMobile ? '' : 'animate-in scale-in duration-200'}`}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                {editingMember ? 'Editar Membro da Igreja' : 'Cadastrar Novo Membro'}
              </h3>
              <button onClick={() => setIsMemberModalOpen(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {memberError && (
              <div className="p-4 mx-5 mt-4 text-xs text-red-600 bg-red-50 rounded-lg border border-red-100 shrink-0">{memberError}</div>
            )}

            <form onSubmit={handleSaveMember} className="p-5 space-y-4 overflow-y-auto flex-1">
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative group">
                  {memberPhotoUrl ? (
                    <img src={memberPhotoUrl} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <span className="text-[10px] font-bold text-center px-2">Alterar<br/>Foto</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 1024 * 1024 * 2) {
                            alert('A foto deve ter no máximo 2MB.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const resultStr = reader.result as string;
                            const tempImg = new Image();
                            tempImg.onload = () => {
                              setCropImgNaturalWidth(tempImg.naturalWidth || tempImg.width || 300);
                              setCropImgNaturalHeight(tempImg.naturalHeight || tempImg.height || 300);
                              setCropImageSrc(resultStr);
                              setCropZoom(1);
                              setCropPanX(0);
                              setCropPanY(0);
                              setIsCropping(true);
                            };
                            tempImg.src = resultStr;
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={memberName}
                    onChange={(e) => setMemberName(validateName(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                    placeholder="Ex: João da Silva"
                  />
                </div>
              </div>


              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone (apenas números)</label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={maskPhone(memberPhone)}
                    onChange={(e) => setMemberPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-mono"
                    placeholder="(00)00000-0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    required
                    value={memberBirthDate}
                    onChange={(e) => setMemberBirthDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Endereço</label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={memberAddress}
                  onChange={(e) => setMemberAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  placeholder="Rua, Número, Bairro, Cidade"
                />
              </div>

              {/* Leader Checkbox */}
              {currentUser.isAdmin && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <input
                    type="checkbox"
                    checked={memberIsLeader}
                    onChange={(e) => setMemberIsLeader(e.target.checked)}
                    className="rounded border-blue-300 text-blue-600 focus:ring-blue-500/10 h-4 w-4"
                  />
                  <label className="text-xs font-bold text-blue-800">Definir como Líder</label>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Identificador / Usuário (Login)</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={memberUsername}
                    onChange={(e) => setMemberUsername(e.target.value.toLowerCase())}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-mono"
                    placeholder="Ex: 443304"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Senha de Acesso (letras e números)</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={memberPassword}
                    onChange={(e) => setMemberPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-mono"
                    placeholder="Senha123"
                  />
                </div>
              </div>

              {(currentUser.isAdmin && (memberIsLeader || memberIsAdmin)) && (
                <div className="flex items-center gap-2 mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <input
                    type="checkbox"
                    checked={memberIsAdmin}
                    onChange={(e) => setMemberIsAdmin(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/10 h-4 w-4"
                  />
                  <label className="text-xs font-bold text-slate-700">Conceder privilégios de Administrador (acesso total)</label>
                </div>
              )}

              {/* Department Checkboxes */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Vincular aos Departamentos:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3 max-h-40 overflow-y-auto">
                  {departments.map((dept, index) => (
                    <label key={`checkbox-dept-${dept.id || index}-${index}`} className="flex items-center gap-2.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer py-1.5">
                      <input
                        type="checkbox"
                        checked={memberSelectedDepts.includes(dept.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMemberSelectedDepts([...memberSelectedDepts, dept.id]);
                          } else {
                            setMemberSelectedDepts(memberSelectedDepts.filter((id) => id !== dept.id));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/10 h-4 w-4"
                      />
                      <span>{dept.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/10"
              >
                {editingMember ? 'Atualizar Cadastro' : 'Criar Conta de Membro'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE CROPPING MODAL */}
      {isCropping && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative z-10 p-5 animate-in scale-in duration-200">
            <h3 className="text-base font-bold text-slate-900 mb-1 text-center">
              Ajustar e Centralizar Foto
            </h3>
            <p className="text-[11px] text-slate-500 text-center mb-5">
              Arraste a foto para centralizar e use o controle deslizante abaixo para ajustar o zoom.
            </p>

            {/* Circular Viewport */}
            {(() => {
              const containerSize = 240;
              const aspect = cropImgNaturalWidth / cropImgNaturalHeight;
              let initWidth = containerSize;
              let initHeight = containerSize;
              if (aspect >= 1) {
                initHeight = containerSize;
                initWidth = containerSize * aspect;
              } else {
                initWidth = containerSize;
                initHeight = containerSize / aspect;
              }
              const startX = (containerSize - initWidth) / 2;
              const startY = (containerSize - initHeight) / 2;

              return (
                <div 
                  className="w-[240px] h-[240px] mx-auto relative overflow-hidden rounded-full bg-slate-950 border-4 border-slate-100 shadow-xl cursor-move select-none touch-none"
                  onMouseDown={handlePhotoDragStart}
                  onMouseMove={handlePhotoDragMove}
                  onMouseUp={handlePhotoDragEnd}
                  onMouseLeave={handlePhotoDragEnd}
                  onTouchStart={handlePhotoDragStart}
                  onTouchMove={handlePhotoDragMove}
                  onTouchEnd={handlePhotoDragEnd}
                  style={{ width: containerSize, height: containerSize }}
                >
                  {cropImageSrc && (
                    <img
                      src={cropImageSrc}
                      alt="Ajuste"
                      draggable={false}
                      style={{
                        width: `${initWidth}px`,
                        height: `${initHeight}px`,
                        left: `${startX + cropPanX}px`,
                        top: `${startY + cropPanY}px`,
                        transform: `scale(${cropZoom})`,
                        transformOrigin: 'center center',
                        position: 'absolute',
                        maxWidth: 'none',
                        maxHeight: 'none',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  {/* Grid guide */}
                  <div className="absolute inset-0 border border-white/20 rounded-full pointer-events-none" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[120px] h-[120px] border border-dashed border-white/10 rounded-full" />
                  </div>
                </div>
              );
            })()}

            {/* Controls */}
            <div className="space-y-1.5 mt-5">
              <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                <span>Aproximar (Zoom)</span>
                <span>{Math.round(cropZoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={cropZoom}
                onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => {
                setCropZoom(1);
                setCropPanX(0);
                setCropPanY(0);
              }}
              className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors mx-auto block cursor-pointer"
            >
              Resetar Posição
            </button>

            {/* Action buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setIsCropping(false);
                  setCropImageSrc(null);
                }}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCrop}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/15 cursor-pointer text-center"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal (Identity Card) */}
      {viewingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotateY: 30 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            className="w-full max-w-sm"
          >
            {/* Identity Card Container */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-2xl relative border-4 border-slate-100">
              {/* Top Header Section */}
              <div className="bg-slate-900 p-6 text-white text-center border-b-4 border-blue-600">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Church className="w-5 h-5 text-blue-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{churchSettings.name || 'Credential Church'}</span>
                  </div>
                  <button 
                    onClick={() => setViewingMember(null)}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="relative inline-block">
                  <div className="w-28 h-28 rounded-2xl bg-blue-600 text-white text-4xl font-black flex items-center justify-center shadow-xl border-4 border-white uppercase mb-2">
                    {viewingMember.photoUrl ? (
                              <img src={viewingMember.photoUrl} alt={viewingMember.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              viewingMember.name.substring(0, 2)
                            )}
                  </div>
                  {viewingMember.isLeader && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-md">
                      Líder
                    </div>
                  )}
                </div>
                
                <h2 className="text-xl font-bold mt-4 tracking-tight uppercase">{viewingMember.name}</h2>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-1">
                  {viewingMember.isLeader ? 'Membro de Liderança' : 'Membro Comungante'}
                </p>
              </div>

              {/* Card Content (Personal Data) */}
              <div className="p-8 space-y-6 bg-slate-50/50">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Identificador</p>
                    <p className="text-xs font-mono font-bold text-slate-700">#{viewingMember.username.toUpperCase()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Membro Desde</p>
                    <p className="text-xs font-bold text-slate-700">{new Date().getFullYear()}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Contato</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{maskPhone(viewingMember.phone || '') || '---'}</p>
                      </div>
                    </div>
                    {viewingMember.phone && (
                      <a
                        href={`https://wa.me/${viewingMember.phone.replace(/\D/g, '').startsWith('55') && viewingMember.phone.replace(/\D/g, '').length >= 12 ? viewingMember.phone.replace(/\D/g, '') : '55' + viewingMember.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0"
                        title="Enviar mensagem no WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Idade / Nascimento</p>
                      <p className="text-xs font-bold text-slate-700">
                        {viewingMember.birthDate ? new Date(viewingMember.birthDate).toLocaleDateString('pt-BR') : '---'}
                        <span className="text-slate-400 ml-1.5 font-medium">
                          ({(() => {
                            if (!viewingMember.birthDate) return '---';
                            const birth = new Date(viewingMember.birthDate);
                            const today = new Date();
                            let age = today.getFullYear() - birth.getFullYear();
                            const monthDiff = today.getMonth() - birth.getMonth();
                            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                              age--;
                            }
                            return age + ' anos';
                          })()})
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Residência</p>
                      <p className="text-xs font-bold text-slate-700 leading-tight">{viewingMember.address || '---'}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <div className="w-6 h-1.5 bg-blue-600 rounded-full"></div>
                      <div className="w-2 h-1.5 bg-slate-200 rounded-full"></div>
                      <div className="w-2 h-1.5 bg-slate-200 rounded-full"></div>
                    </div>
                    <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic">Official Credential</div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-4 bg-slate-100 flex justify-center">
                <button 
                  onClick={() => setViewingMember(null)}
                  className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                >
                  Fechar Credencial
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* DEPT CREATE MODAL */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold font-serif">Novo Departamento</h3>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">Gestão Estrutural</p>
              </div>
              <button onClick={() => setIsDeptModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {deptError && (
                <div className="p-3 text-xs text-red-600 bg-red-50 rounded-xl border border-red-100 font-bold flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {deptError}
                </div>
              )}

              <form onSubmit={handleSaveDept} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Nome do Departamento</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full px-4 py-3 text-sm border-2 border-slate-100 rounded-xl outline-none focus:border-blue-600 transition-all bg-slate-50/50 font-bold"
                    placeholder="Ex: Ministério de Oração, Casais..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Descrição do Propósito</label>
                  <textarea
                    required
                    maxLength={500}
                    rows={4}
                    value={newDeptDesc}
                    onChange={(e) => setNewDeptDesc(e.target.value)}
                    className="w-full px-4 py-3 text-sm border-2 border-slate-100 rounded-xl outline-none focus:border-blue-600 transition-all bg-slate-50/50 font-bold resize-none"
                    placeholder="Descreva brevemente para que serve este ministério..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDeptModalOpen(false)}
                    className="flex-1 py-3 px-4 border-2 border-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-2 py-3 px-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
                  >
                    Criar Departamento
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Event Form Modal for Líderes department */}
      <EventFormModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setEventToEdit(null);
        }}
        onSave={onSaveEvent}
        eventToEdit={eventToEdit}
        churchSettings={churchSettings}
      />
    </div>
  );
}
