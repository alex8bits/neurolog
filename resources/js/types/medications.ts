// Web medications page: a row from the paginated list (`MedicationRowResource`)
// and the applied list filters. Labels are pre-formatted on the server; raw
// values (`dosage`, `unit`, `*_date`) feed the edit form as-is. Also the
// dictionary entry (`MedicationNameRow`) used by the dictionary page and the
// medications combobox.

export type MedicationStatus = 'planned' | 'active' | 'finished';

export type MedicationUnit = 'mg' | 'ml' | 'pil';

export type MedicationRow = {
    id: number;
    medication_name_id: number;
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

/** A dictionary entry (`MedicationNameRowResource`): the medications page combobox and the dictionary page. */
export type MedicationNameRow = {
    id: number;
    name: string;
    medications_count: number;
};

export type MedicationFilters = {
    q: string | null;
    from: string | null;
    to: string | null;
    status: MedicationStatus | null;
};
