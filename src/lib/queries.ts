import { supabase } from "@/integrations/supabase/client";
import type { AppointmentStatus } from "./clinic";

export type DoctorRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  specialization: string;
  qualification: string | null;
  years_experience: number;
  phone: string | null;
  email: string | null;
  consultation_fee: number;
  bio: string | null;
  availability_status: boolean;
};

export type AvailabilityRow = {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
};

export type AppointmentRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  appointment_time: string;
  reason: string | null;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  doctors?: Pick<DoctorRow, "id" | "full_name" | "specialization"> | null;
};

export type PatientSummary = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  address: string | null;
};

export type MedicalRecordRow = {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  diagnosis: string;
  treatment: string;
  prescription: string;
  consultation_notes: string | null;
  record_date: string;
  doctors?: Pick<DoctorRow, "id" | "full_name" | "specialization"> | null;
};

export async function fetchDoctors() {
  const { data, error } = await supabase.from("doctors").select("*").order("full_name");
  if (error) throw error;
  return (data ?? []) as unknown as DoctorRow[];
}

export async function fetchAvailability(doctorId?: string) {
  let query = supabase.from("doctor_availability").select("*").order("day_of_week");
  if (doctorId) query = query.eq("doctor_id", doctorId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AvailabilityRow[];
}

export async function fetchAppointments(filters?: {
  patientId?: string;
  doctorId?: string;
  date?: string;
  status?: AppointmentStatus;
}) {
  let query = supabase
    .from("appointments")
    .select("*, doctors(id, full_name, specialization)")
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: true });

  if (filters?.patientId) query = query.eq("patient_id", filters.patientId);
  if (filters?.doctorId) query = query.eq("doctor_id", filters.doctorId);
  if (filters?.date) query = query.eq("appointment_date", filters.date);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AppointmentRow[];
}

export async function fetchPatients(search?: string) {
  let query = supabase.from("profiles").select("*").order("first_name").limit(200);
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PatientSummary[];
}

export async function fetchProfilesByIds(ids: string[]) {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return {} as Record<string, PatientSummary>;
  const { data, error } = await supabase.from("profiles").select("*").in("id", unique);
  if (error) throw error;
  const map: Record<string, PatientSummary> = {};
  for (const row of (data ?? []) as unknown as PatientSummary[]) map[row.id] = row;
  return map;
}

export async function fetchMedicalRecords(filters?: { patientId?: string; doctorId?: string }) {
  let query = supabase
    .from("medical_records")
    .select("*, doctors(id, full_name, specialization)")
    .order("record_date", { ascending: false });
  if (filters?.patientId) query = query.eq("patient_id", filters.patientId);
  if (filters?.doctorId) query = query.eq("doctor_id", filters.doctorId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as MedicalRecordRow[];
}

export async function notify(userId: string, title: string, message: string, type = "info") {
  await supabase.from("notifications").insert({ user_id: userId, title, message, type } as never);
}

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

export async function fetchNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as NotificationRow[];
}

export async function markNotificationRead(id: string, isRead = true) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: isRead } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true } as never)
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function sendNotification(input: {
  userIds: string[];
  title: string;
  message: string;
  type?: string;
}) {
  const rows = input.userIds.map((user_id) => ({
    user_id,
    title: input.title,
    message: input.message,
    type: input.type ?? "info",
  }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("notifications").insert(rows as never);
  if (error) throw error;
}