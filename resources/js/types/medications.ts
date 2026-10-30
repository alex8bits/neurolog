// Web medications page: a row from the paginated list (`MedicationRowResource`)
// and the applied list filters. Labels are pre-formatted on the server; raw
// values (`dosage`, `unit`, `*_date`) feed the edit form as-is.

export type MedicationStatus = 'planned' | 'active' | 'finished';

export type MedicationUnit = 'mg' | 'ml';

export type MedicationRow = {
    id: number;
    name: string;
    dosage: string;
    dosage_label: string;
    unit: MedicationUnit;
    start_date: string;
    end_date: string | null;
    start_label: string;
    end_label: string | null;
    status: MedicationStatus;
};

export type MedicationFilters = {
    q: string | null;
    from: string | null;
    to: string | null;
    status: MedicationStatus | null;
};
