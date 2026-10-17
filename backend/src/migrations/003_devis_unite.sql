-- Ajout de la colonne unite aux lignes de devis
ALTER TABLE lignes_devis ADD COLUMN IF NOT EXISTS unite VARCHAR(50) NOT NULL DEFAULT 'U';
