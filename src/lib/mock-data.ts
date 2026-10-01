import {
  Zap,
  Tv,
  GraduationCap,
  Smartphone,
  Wifi,
  Globe,
  Droplets,
  ShieldCheck,
  Ticket,
  Building2,
  Fingerprint,
  Hash,
  FileText,
  MoreHorizontal,
  Car,
  type LucideIcon,
} from "lucide-react";

export type TxStatus = "successful" | "pending" | "failed";

export type Transaction = {
  id: string;
  title: string;
  service: string;
  serviceSlug: string;
  amount: number;
  direction: "in" | "out";
  status: TxStatus;
  date: string;
  time: string;
  customer?: string;
  reference?: string;
  method: string;
  token?: string;
};

export type SavedPayment = {
  id: string;
  label: string;
  provider: string;
  serviceSlug: ServiceSlug;
  masked: string;
  identifier: string;
};

export type AppNotification = {
  id: string;
  type: "success" | "warning" | "info";
  title: string;
  body: string;
  time: string;
  read: boolean;
};

export type ServiceSlug =
  | "electricity"
  | "cable"
  | "education"
  | "airtime"
  | "data"
  | "internet"
  | "water"
  | "insurance"
  | "exam-pins"
  | "cac"
  | "nin"
  | "tin"
  | "documents"
  | "vehicle";

export type Package = { id: string; name: string; price: number; note?: string };

export type ServiceConfig = {
  slug: ServiceSlug;
  name: string;
  short: string;
  icon: LucideIcon;
  tint: string;
  providerLabel: string;
  providers: string[];
  identifierLabel: string;
  identifierPlaceholder: string;
  identifierHelp?: string;
  verifies: boolean;
  mode: "amount" | "package";
  packages?: Package[];
  quickAmounts?: number[];
  customerName?: string;
  address?: string;
  numeric?: boolean;
};

export const SERVICES: ServiceConfig[] = [
  {
    slug: "electricity",
    name: "Electricity",
    short: "Electricity",
    icon: Zap,
    tint: "text-[#D97706] bg-[#FEF3C7] border border-[#FDE68A]/60 shadow-[0_4px_12px_-2px_rgba(245,158,11,0.15)]",
    providerLabel: "Select electricity provider",
    providers: ["AEDC", "EKEDC", "IKEDC", "PHED", "JED", "KEDCO", "Kaduna Electric"],
    identifierLabel: "Meter Number",
    identifierPlaceholder: "Enter your meter number",
    identifierHelp:
      "Check your electricity bill or the display on your meter. It is usually 11 digits long.",
    verifies: true,
    mode: "amount",
    quickAmounts: [1000, 5000, 10000, 20000],
    customerName: "John Doe",
    address: "23, Allen Avenue, Ikeja, Lagos",
    numeric: true,
  },
  {
    slug: "cable",
    name: "Cable TV",
    short: "Cable TV",
    icon: Tv,
    tint: "text-[#0D9488] bg-[#CCFBF1] border border-[#99F6E4]/60 shadow-[0_4px_12px_-2px_rgba(13,148,136,0.15)]",
    providerLabel: "Select cable provider",
    providers: ["DSTV", "GOtv", "StarTimes"],
    identifierLabel: "Smartcard / IUC Number",
    identifierPlaceholder: "Enter your smartcard number",
    identifierHelp: "Your IUC number is printed on your decoder or shown in the settings menu.",
    verifies: true,
    mode: "package",
    packages: [
      { id: "premium", name: "Premium", price: 29000, note: "All channels + sports" },
      { id: "compact-plus", name: "Compact Plus", price: 19000, note: "Movies, series, sports" },
      { id: "compact", name: "Compact", price: 12000, note: "Family entertainment" },
      { id: "yanga", name: "Yanga", price: 6000, note: "Local favourites" },
    ],
    customerName: "John Doe",
    numeric: true,
  },
  {
    slug: "education",
    name: "Education",
    short: "Education",
    icon: GraduationCap,
    tint: "text-[#7C3AED] bg-[#EDE9FE] border border-[#DDD6FE]/60 shadow-[0_4px_12px_-2px_rgba(124,58,237,0.15)]",
    providerLabel: "Select exam body",
    providers: ["WAEC", "NECO", "NABTEB", "JAMB"],
    identifierLabel: "Quantity",
    identifierPlaceholder: "",
    verifies: false,
    mode: "package",
    packages: [],
    numeric: true,
  },
  {
    slug: "airtime",
    name: "Airtime",
    short: "Airtime",
    icon: Smartphone,
    tint: "text-[#DB2777] bg-[#FCE7F3] border border-[#FBCFE8]/60 shadow-[0_4px_12px_-2px_rgba(219,39,119,0.15)]",
    providerLabel: "Select network",
    providers: ["MTN", "Airtel", "Glo", "9mobile"],
    identifierLabel: "Phone Number",
    identifierPlaceholder: "0801 234 5678",
    verifies: false,
    mode: "amount",
    quickAmounts: [100, 200, 500, 1000, 2000],
    numeric: true,
  },
  {
    slug: "data",
    name: "Data",
    short: "Data",
    icon: Wifi,
    tint: "text-[#2563EB] bg-[#DBEAFE] border border-[#BFDBFE]/60 shadow-[0_4px_12px_-2px_rgba(37,99,235,0.15)]",
    providerLabel: "Select network",
    providers: ["MTN", "Airtel", "Glo", "9mobile"],
    identifierLabel: "Phone Number",
    identifierPlaceholder: "0801 234 5678",
    verifies: false,
    mode: "package",
    packages: [],
    numeric: true,
  },
  {
    slug: "internet",
    name: "Internet",
    short: "Internet",
    icon: Globe,
    tint: "text-[#0891B2] bg-[#CFFAFE] border border-[#A5F3FC]/60 shadow-[0_4px_12px_-2px_rgba(8,145,178,0.15)]",
    providerLabel: "Provider",
    providers: ["Smile", "Spectranet"],
    identifierLabel: "Account",
    identifierPlaceholder: "",
    verifies: false,
    mode: "package",
    packages: [],
  },
  {
    slug: "water",
    name: "Water",
    short: "Water",
    icon: Droplets,
    tint: "text-[#0284C7] bg-[#E0F2FE] border border-[#BAE6FD]/60 shadow-[0_4px_12px_-2px_rgba(2,132,199,0.15)]",
    providerLabel: "Provider",
    providers: [],
    identifierLabel: "Account",
    identifierPlaceholder: "",
    verifies: false,
    mode: "amount",
  },
  {
    slug: "insurance",
    name: "Insurance",
    short: "Insurance",
    icon: ShieldCheck,
    tint: "text-[#059669] bg-[#D1FAE5] border border-[#A7F3D0]/60 shadow-[0_4px_12px_-2px_rgba(5,150,105,0.15)]",
    providerLabel: "Provider",
    providers: [],
    identifierLabel: "Policy",
    identifierPlaceholder: "",
    verifies: false,
    mode: "amount",
  },
  {
    slug: "exam-pins",
    name: "Exam Pins",
    short: "Exam Pins",
    icon: Ticket,
    tint: "text-warning bg-warning-soft",
    providerLabel: "Exam",
    providers: ["WAEC", "NECO", "NABTEB", "JAMB"],
    identifierLabel: "Quantity",
    identifierPlaceholder: "",
    verifies: false,
    mode: "package",
    packages: [],
    numeric: true,
  },
  {
    slug: "cac",
    name: "CAC Registration",
    short: "CAC",
    icon: Building2,
    tint: "text-[#0F766E] bg-[#CCFBF1] border border-[#99F6E4]/60 shadow-[0_4px_12px_-2px_rgba(15,118,110,0.15)]",
    providerLabel: "Business registration",
    providers: ["Business Name"],
    identifierLabel: "Application",
    identifierPlaceholder: "",
    verifies: false,
    mode: "package",
    packages: [
      {
        id: "bn-start",
        name: "Start Business (Business Name)",
        price: 27500,
        note: "Demo package",
      },
    ],
  },
  {
    slug: "nin",
    name: "NIN Services",
    short: "NIN",
    icon: Fingerprint,
    tint: "text-[#4F46E5] bg-[#E0E7FF] border border-[#C7D2FE]/60 shadow-[0_4px_12px_-2px_rgba(79,70,229,0.15)]",
    providerLabel: "NIN helpers",
    providers: ["Retrieve NIN", "Print NIN Slip", "Plastic ID-style card"],
    identifierLabel: "NIN / Phone",
    identifierPlaceholder: "",
    verifies: false,
    mode: "package",
    packages: [
      { id: "nin-retrieve", name: "Retrieve NIN", price: 300, note: "Demo" },
      { id: "nin-slip", name: "Print NIN Slip", price: 500, note: "Demo" },
      { id: "nin-plastic", name: "Plastic ID-style NIN card", price: 2500, note: "Demo" },
    ],
  },
  {
    slug: "tin",
    name: "TIN Retrieval",
    short: "TIN",
    icon: Hash,
    tint: "text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A]/60 shadow-[0_4px_12px_-2px_rgba(180,83,9,0.15)]",
    providerLabel: "JTB TIN",
    providers: ["NIN lookup", "CAC lookup"],
    identifierLabel: "NIN / CAC",
    identifierPlaceholder: "",
    verifies: false,
    mode: "package",
    packages: [{ id: "tin-retrieve", name: "TIN Retrieval", price: 1500, note: "Demo" }],
  },
  {
    slug: "documents",
    name: "Documents",
    short: "Docs",
    icon: FileText,
    tint: "text-[#475569] bg-[#F1F5F9] border border-[#E2E8F0]/80 shadow-[0_4px_12px_-2px_rgba(71,85,105,0.12)]",
    providerLabel: "Document generator",
    providers: ["Business Constitution", "Tenancy Agreement"],
    identifierLabel: "Document",
    identifierPlaceholder: "",
    verifies: false,
    mode: "package",
    packages: [{ id: "doc-gen", name: "Document draft", price: 3000, note: "Demo" }],
  },
  {
    slug: "vehicle",
    name: "Vehicle papers",
    short: "Vehicle",
    icon: Car,
    tint: "text-[#0369A1] bg-[#E0F2FE] border border-[#BAE6FD]/60 shadow-[0_4px_12px_-2px_rgba(3,105,161,0.15)]",
    providerLabel: "Vehicle registry",
    providers: ["Plate lookup", "Renewal sync"],
    identifierLabel: "Plate",
    identifierPlaceholder: "ABC-123XY",
    verifies: false,
    mode: "package",
    packages: [
      { id: "vehicle-renewal", name: "Vehicle paperwork / renewal", price: 2500, note: "Demo" },
    ],
  },
];

export const MoreIcon = MoreHorizontal;

export function getService(slug: string): ServiceConfig | undefined {
  return SERVICES.find((s) => s.slug === slug);
}

export const INITIAL_BALANCE = 25450;

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "TXN-482913",
    title: "Electricity Payment",
    service: "AEDC Electricity",
    serviceSlug: "electricity",
    amount: 10000,
    direction: "out",
    status: "successful",
    date: "13 Aug 2026",
    time: "11:15 AM",
    customer: "John Doe",
    reference: "REF-482913",
    method: "Wallet",
    token: "1234-5678-9012-3456",
  },
  {
    id: "TXN-482900",
    title: "DSTV Compact",
    service: "Cable TV",
    serviceSlug: "cable",
    amount: 12000,
    direction: "out",
    status: "successful",
    date: "12 Aug 2026",
    time: "6:40 PM",
    customer: "John Doe",
    method: "Wallet",
  },
  {
    id: "TXN-482850",
    title: "Wallet Funded",
    service: "Wallet",
    serviceSlug: "airtime",
    amount: 20000,
    direction: "in",
    status: "successful",
    date: "12 Aug 2026",
    time: "9:02 AM",
    method: "Paystack",
  },
  {
    id: "TXN-482800",
    title: "Data Purchase",
    service: "MTN Data",
    serviceSlug: "data",
    amount: 2500,
    direction: "out",
    status: "successful",
    date: "11 Aug 2026",
    time: "3:18 PM",
    method: "Wallet",
  },
];

export const INITIAL_SAVED: SavedPayment[] = [
  {
    id: "svd-1",
    label: "Home Electricity",
    provider: "AEDC",
    serviceSlug: "electricity",
    masked: "••••901",
    identifier: "12345678901",
  },
  {
    id: "svd-2",
    label: "My DSTV",
    provider: "DSTV",
    serviceSlug: "cable",
    masked: "••••123",
    identifier: "7012345678",
  },
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    type: "success",
    title: "Electricity payment successful",
    body: "Your AEDC payment of ₦10,000 was successful.",
    time: "2h ago",
    read: false,
  },
  {
    id: "n2",
    type: "success",
    title: "Wallet funded",
    body: "₦20,000 was added to your wallet.",
    time: "1d ago",
    read: true,
  },
  {
    id: "n3",
    type: "warning",
    title: "Transaction pending",
    body: "A recent payment is still being confirmed.",
    time: "2d ago",
    read: true,
  },
  {
    id: "n4",
    type: "info",
    title: "Welcome to RockPay",
    body: "Thanks for joining. Fund your wallet to start paying bills instantly.",
    time: "3d ago",
    read: true,
  },
];

export function formatNaira(amount: number, withSymbol = true): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const formatted = n.toLocaleString("en-NG", { maximumFractionDigits: 2 });
  return withSymbol ? `₦${formatted}` : formatted;
}

export function maskTail(value: string, keep = 4): string {
  const v = String(value ?? "");
  if (v.length <= keep) return v;
  return `••••${v.slice(-keep)}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
