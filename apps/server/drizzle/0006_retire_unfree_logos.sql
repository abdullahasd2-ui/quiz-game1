-- Real Madrid's and Chelsea's crests have no freely licensed file, so their picture questions are switched off
-- (the questions stay in the bank; an admin can turn them back on with a picture of their own).
UPDATE "questions" SET "active" = false WHERE "image_url" IN ('legacy-draw:club_rm', 'legacy-draw:club_chelsea');
