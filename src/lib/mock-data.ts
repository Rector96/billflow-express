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
  MoreHorizontal,
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
};

export const DEMO_USER = {
  name: "Pablo Emmanuel",
  firstName: "Pablo",
  phone: "0803 123 4567",
  email: "pablo@example.com",
  initials: "PE",
  billpayId: "48291736",
};

export const DEMO_PIN = "1234";

export type ServiceSlug =
  | "electricity"
  | "cable"
  | "education"
  | "airtime"
  | "data"
  | "internet"
  | "water"
  | "insurance"
  | "exam-pins";

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
    tint: "text-warning bg-warning-soft",
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
    tint: "text-success bg-success-soft",
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
    tint: "text-primary bg-primary-soft",
    providerLabel: "Select education service",
    providers: ["WAEC", "JAMB", "NECO", "NABTEB"],
    identifierLabel: "Profile / Candidate Number",
    identifierPlaceholder: "Enter candidate number",
    identifierHelp: "Use the profile code sent to you when you registered.",
    verifies: true,
    mode: "package",
    packages: [
      { id: "waec-result", name: "Result Checker PIN", price: 3500, note: "1 PIN" },
      { id: "waec-reg", name: "Registration PIN", price: 27000, note: "1 PIN" },
      { id: "jamb-utme", name: "UTME PIN", price: 7700, note: "Direct entry available" },
    ],
    customerName: "John Doe",
  },
  {
    slug: "airtime",
    name: "Airtime",
    short: "Airtime",
    icon: Smartphone,
    tint: "text-destructive bg-destructive-soft",
    providerLabel: "Select network",
    providers: ["MTN", "Airtel", "Glo", "9mobile"],
    identifierLabel: "Phone Number",
    identifierPlaceholder: "080 0000 0000",
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
    tint: "text-primary bg-primary-soft",
    providerLabel: "Select network",
    providers: ["MTN", "Airtel", "Glo", "9mobile"],
    identifierLabel: "Phone Number",
    identifierPlaceholder: "080 0000 0000",
    verifies: false,
    mode: "package",
    packages: [
      { id: "d1", name: "1GB", price: 500, note: "30 days" },
      { id: "d2", name: "2GB", price: 1000, note: "30 days" },
      { id: "d3", name: "5GB", price: 2500, note: "30 days" },
      { id: "d4", name: "10GB", price: 4500, note: "30 days" },
      { id: "d5", name: "40GB", price: 12000, note: "60 days" },
    ],
    numeric: true,
  },
  {
    slug: "internet",
    name: "Internet",
    short: "Internet",
    icon: Globe,
    tint: "text-primary bg-primary-soft",
    providerLabel: "Select internet provider",
    providers: ["Smile", "Spectranet", "Swift"],
    identifierLabel: "Account / Device ID",
    identifierPlaceholder: "Enter account ID",
    verifies: true,
    mode: "package",
    packages: [
      { id: "i1", name: "Starter 20GB", price: 8000, note: "30 days" },
      { id: "i2", name: "Value 60GB", price: 15000, note: "30 days" },
      { id: "i3", name: "Unlimited", price: 25000, note: "30 days" },
    ],
    customerName: "John Doe",
  },
  {
    slug: "water",
    name: "Water",
    short: "Water",
    icon: Droplets,
    tint: "text-primary bg-primary-soft",
    providerLabel: "Select water board",
    providers: ["Lagos Water Corporation", "FCT Water Board", "Abia Water"],
    identifierLabel: "Customer ID",
    identifierPlaceholder: "Enter customer ID",
    verifies: true,
    mode: "amount",
    quickAmounts: [2000, 5000, 10000, 15000],
    customerName: "John Doe",
  },
  {
    slug: "insurance",
    name: "Insurance",
    short: "Insurance",
    icon: ShieldCheck,
    tint: "text-success bg-success-soft",
    providerLabel: "Select insurance plan",
    providers: ["Third Party Motor", "Health Cover", "Home Cover"],
    identifierLabel: "Policy / Plate Number",
    identifierPlaceholder: "Enter policy number",
    verifies: true,
    mode: "package",
    packages: [
      { id: "p1", name: "Private Vehicle", price: 15000, note: "12 months" },
      { id: "p2", name: "Commercial Vehicle", price: 22000, note: "12 months" },
    ],
    customerName: "John Doe",
  },
  {
    slug: "exam-pins",
    name: "Exam Pins",
    short: "Exam Pins",
    icon: Ticket,
    tint: "text-warning bg-warning-soft",
    providerLabel: "Select exam body",
    providers: ["WAEC", "NECO", "NABTEB"],
    identifierLabel: "Phone Number",
    identifierPlaceholder: "080 0000 0000",
    verifies: false,
    mode: "package",
    packages: [
      { id: "e1", name: "1 PIN", price: 3500 },
      { id: "e2", name: "3 PINs", price: 10200 },
      { id: "e3", name: "5 PINs", price: 16800 },
    ],
    numeric: true,
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
    reference: "••••••8901",
    method: "Wallet",
    token: "1234 5678 9012 3456",
  },
  {
    id: "TXN-482884",
    title: "Cable TV Payment",
    service: "DSTV Compact Plus",
    serviceSlug: "cable",
    amount: 15000,
    direction: "out",
    status: "successful",
    date: "12 Aug 2026",
    time: "12:30 PM",
    customer: "John Doe",
    reference: "••••123",
    method: "Wallet",
  },
  {
    id: "TXN-482801",
    title: "Wallet Funded",
    service: "Card Top-up",
    serviceSlug: "wallet",
    amount: 20000,
    direction: "in",
    status: "successful",
    date: "12 Aug 2026",
    time: "10:20 AM",
    method: "Card",
  },
  {
    id: "TXN-482740",
    title: "Data Purchase",
    service: "MTN 5GB",
    serviceSlug: "data",
    amount: 2500,
    direction: "out",
    status: "successful",
    date: "11 Aug 2026",
    time: "1:45 PM",
    reference: "0803 123 4567",
    method: "Wallet",
  },
  {
    id: "TXN-482655",
    title: "Airtime Purchase",
    service: "MTN Airtime",
    serviceSlug: "airtime",
    amount: 1000,
    direction: "out",
    status: "pending",
    date: "10 Aug 2026",
    time: "2:30 PM",
    reference: "0803 123 4567",
    method: "Wallet",
  },
  {
    id: "TXN-482610",
    title: "Electricity Payment",
    service: "EKEDC Electricity",
    serviceSlug: "electricity",
    amount: 5000,
    direction: "out",
    status: "failed",
    date: "09 Aug 2026",
    time: "9:05 AM",
    customer: "John Doe",
    reference: "••••••4521",
    method: "Wallet",
  },
];

export const INITIAL_SAVED: SavedPayment[] = [
  {
    id: "sp1",
    label: "Home Electricity",
    provider: "AEDC",
    serviceSlug: "electricity",
    masked: "Meter ••••901",
    identifier: "12345678901",
  },
  {
    id: "sp2",
    label: "Office Electricity",
    provider: "AEDC",
    serviceSlug: "electricity",
    masked: "Meter ••••4521",
    identifier: "12345674521",
  },
  {
    id: "sp3",
    label: "My DSTV",
    provider: "DSTV",
    serviceSlug: "cable",
    masked: "Smartcard ••••123",
    identifier: "70123456123",
  },
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    type: "success",
    title: "Electricity payment successful",
    body: "Your ₦10,000 AEDC payment was completed. Token issued.",
    time: "Today • 11:16 AM",
  },
  {
    id: "n2",
    type: "success",
    title: "Wallet funded with ₦10,000",
    body: "Your wallet top-up was received successfully.",
    time: "Today • 10:20 AM",
  },
  {
    id: "n3",
    type: "warning",
    title: "Your transaction is still pending",
    body: "MTN airtime of ₦1,000 is being confirmed by the network.",
    time: "Yesterday • 2:31 PM",
  },
  {
    id: "n4",
    type: "info",
    title: "Welcome 🎉",
    body: "Thanks for joining. Fund your wallet to start paying bills instantly.",
    time: "10 Aug • 8:00 AM",
  },
];

export function formatNaira(amount: number, withKobo = true): string {
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: withKobo ? 2 : 0,
    maximumFractionDigits: withKobo ? 2 : 0,
  })}`;
}

export function maskTail(value: string, visible = 4): string {
  if (!value) return "";
  const tail = value.slice(-visible);
  return `••••••${tail}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
