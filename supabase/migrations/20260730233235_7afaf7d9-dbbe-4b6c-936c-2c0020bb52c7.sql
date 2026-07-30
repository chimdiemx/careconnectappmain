
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','doctor','receptionist','patient');
CREATE TYPE public.appointment_status AS ENUM ('scheduled','confirmed','completed','cancelled','no_show');

-- UPDATED AT HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  gender TEXT,
  date_of_birth DATE,
  address TEXT,
  blood_group TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','doctor','receptionist'));
$$;

-- DOCTORS
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  qualification TEXT,
  years_experience INT NOT NULL DEFAULT 0,
  phone TEXT,
  email TEXT,
  consultation_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  bio TEXT,
  availability_status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- DOCTOR AVAILABILITY
CREATE TABLE public.doctor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_minutes INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, day_of_week)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_availability TO authenticated;
GRANT ALL ON public.doctor_availability TO service_role;
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  reason TEXT,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  reminder_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX appointments_no_conflict
  ON public.appointments (doctor_id, appointment_date, appointment_time)
  WHERE status IN ('scheduled','confirmed');
CREATE INDEX appointments_patient_idx ON public.appointments (patient_id, appointment_date DESC);
CREATE INDEX appointments_doctor_idx ON public.appointments (doctor_id, appointment_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- MEDICAL RECORDS
CREATE TABLE public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  diagnosis VARCHAR(255) NOT NULL,
  treatment VARCHAR(255) NOT NULL,
  prescription VARCHAR(150) NOT NULL,
  consultation_notes TEXT,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX medical_records_patient_idx ON public.medical_records (patient_id, record_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_records TO authenticated;
GRANT ALL ON public.medical_records TO service_role;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- helper: current user's doctor row
CREATE OR REPLACE FUNCTION public.current_doctor_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1;
$$;

-- POLICIES: profiles
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist'));
CREATE POLICY "admin profile delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- POLICIES: user_roles
CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- POLICIES: doctors
CREATE POLICY "doctors read" ON public.doctors FOR SELECT TO authenticated USING (true);
CREATE POLICY "doctors admin write" ON public.doctors FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "doctors update" ON public.doctors FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR user_id = auth.uid());
CREATE POLICY "doctors admin delete" ON public.doctors FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- POLICIES: availability
CREATE POLICY "availability read" ON public.doctor_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "availability write" ON public.doctor_availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR doctor_id = public.current_doctor_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR doctor_id = public.current_doctor_id());

-- POLICIES: appointments
CREATE POLICY "appointments read" ON public.appointments FOR SELECT TO authenticated
  USING (patient_id = auth.uid()
     OR doctor_id = public.current_doctor_id()
     OR public.has_role(auth.uid(),'admin')
     OR public.has_role(auth.uid(),'receptionist'));
CREATE POLICY "appointments insert" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid()
     OR public.has_role(auth.uid(),'admin')
     OR public.has_role(auth.uid(),'receptionist'));
CREATE POLICY "appointments update" ON public.appointments FOR UPDATE TO authenticated
  USING (patient_id = auth.uid()
     OR doctor_id = public.current_doctor_id()
     OR public.has_role(auth.uid(),'admin')
     OR public.has_role(auth.uid(),'receptionist'))
  WITH CHECK (patient_id = auth.uid()
     OR doctor_id = public.current_doctor_id()
     OR public.has_role(auth.uid(),'admin')
     OR public.has_role(auth.uid(),'receptionist'));
CREATE POLICY "appointments delete" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- POLICIES: medical records
CREATE POLICY "records read" ON public.medical_records FOR SELECT TO authenticated
  USING (patient_id = auth.uid()
     OR doctor_id = public.current_doctor_id()
     OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "records write" ON public.medical_records FOR INSERT TO authenticated
  WITH CHECK (doctor_id = public.current_doctor_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "records update" ON public.medical_records FOR UPDATE TO authenticated
  USING (doctor_id = public.current_doctor_id() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (doctor_id = public.current_doctor_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "records delete" ON public.medical_records FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- POLICIES: notifications
CREATE POLICY "notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR user_id = auth.uid());

-- TRIGGERS
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER doctors_updated BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER records_updated BEFORE UPDATE ON public.medical_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NEW USER HANDLER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DEMO DOCTORS
INSERT INTO public.doctors (id, full_name, specialization, qualification, years_experience, phone, email, consultation_fee, bio, availability_status) VALUES
('11111111-1111-4111-8111-111111111111','Dr. Amaka Obi','General Medicine','MBBS, MPH',12,'+234 801 234 5678','amaka.obi@careconnect.health',15000,'Family physician focused on preventive care and chronic disease management.',true),
('22222222-2222-4222-8222-222222222222','Dr. Tunde Bakare','Cardiology','MBBS, FWACP',18,'+234 802 345 6789','tunde.bakare@careconnect.health',25000,'Consultant cardiologist with a special interest in hypertension.',true),
('33333333-3333-4333-8333-333333333333','Dr. Ngozi Eze','Pediatrics','MBBS, FMCPaed',9,'+234 803 456 7890','ngozi.eze@careconnect.health',18000,'Paediatrician caring for newborns through adolescents.',true),
('44444444-4444-4444-8444-444444444444','Dr. Samuel Adeyemi','Dermatology','MBBS, MSc Derm',7,'+234 804 567 8901','samuel.adeyemi@careconnect.health',20000,'Dermatologist treating skin, hair and nail conditions.',true),
('55555555-5555-4555-8555-555555555555','Dr. Fatima Yusuf','Orthopaedics','MBBS, FMCS',15,'+234 805 678 9012','fatima.yusuf@careconnect.health',30000,'Orthopaedic surgeon specialising in sports injuries.',false);

INSERT INTO public.doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_minutes)
SELECT d.id, dow, '09:00', '16:00', 30
FROM public.doctors d CROSS JOIN generate_series(1,5) AS dow;
