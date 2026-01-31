
export enum PlanType {
  FURNITURE_REMOVE = 'FURNITURE_REMOVE',
  FURNITURE_ADD = 'FURNITURE_ADD',
  FURNITURE_BOTH = 'FURNITURE_BOTH',
  FLOOR_PLAN_CG = 'FLOOR_PLAN_CG'
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  price: string;
  amount: number;
  number: string;
  isVisible?: boolean; // 表示・非表示フラグを追加
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'user';
  editorRecordId?: string; 
}

export interface ArchiveProject {
  id: string;
  title: string;
  category: string;
  beforeurl: string;
  afterurl: string;
  description: string;
  timestamp: number;
}

export interface Editor {
  id: string;
  name: string;
  email?: string;
  specialty: string;
}

export interface ReferenceImage {
  id: string;
  dataUrl: string;
  fileName: string;
  description: string;
}

export interface Message {
  id: string;
  submission_id?: string;
  sender_id?: string;
  sender_name?: string;
  sender_role?: string;
  content: string;
  timestamp: number;
}

export interface Submission {
  id: string;
  ownerId: string;
  ownerEmail?: string;
  plan: PlanType;
  fileName: string;
  fileSize: number;
  dataUrl: string; 
  resultDataUrl?: string;
  resultRemoveUrl?: string;
  resultAddUrl?: string;
  instructions?: string; 
  revisionNotes?: string; 
  referenceImages?: ReferenceImage[]; 
  timestamp: number;
  status: 'pending' | 'processing' | 'reviewing' | 'completed' | 'quote_request';
  paymentStatus: 'unpaid' | 'paid' | 'quote_pending';
  stripeSessionId?: string;
  assignedEditorId?: string;
  quotedAmount?: number; // Added for custom quotes
}

export const DEFAULT_PLANS: Record<string, Plan> = {
  [PlanType.FURNITURE_REMOVE]: {
    id: PlanType.FURNITURE_REMOVE,
    title: 'Furniture Removal',
    description: 'Advanced removal of existing assets. We clean the digital canvas to reveal the structural potential of your space.',
    price: '$35',
    amount: 3500,
    number: '01',
    isVisible: true
  },
  [PlanType.FURNITURE_ADD]: {
    id: PlanType.FURNITURE_ADD,
    title: 'Furniture Addition',
    description: 'Precision staging for vacant rooms. Curated sets selected by architectural visualizers to maximize market value.',
    price: '$35',
    amount: 3500,
    number: '02',
    isVisible: true
  },
  [PlanType.FURNITURE_BOTH]: {
    id: PlanType.FURNITURE_BOTH,
    title: 'Full Staging (Both)',
    description: 'Complete spatial overhaul. Existing items are removed and replaced with elite, high-resolution digital staging.',
    price: '$60',
    amount: 6000,
    number: '03',
    isVisible: true
  },
  [PlanType.FLOOR_PLAN_CG]: {
    id: PlanType.FLOOR_PLAN_CG,
    title: '3D Floor Plan (Overhead)',
    description: 'Transformation of 2D floor plans into high-end 3D overhead visualizations. Comprehensive spatial modeling based on architectural drawings.',
    price: 'Custom Quote',
    amount: 0,
    number: '04',
    isVisible: true
  }
};

export const getEstimatedDeliveryDate = (timestamp: number): Date => {
  let date = new Date(timestamp);
  let businessDaysAdded = 0;
  let safetyCounter = 0;
  while (businessDaysAdded < 3 && safetyCounter < 15) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      businessDaysAdded++;
    }
    safetyCounter++;
  }
  return date;
};
