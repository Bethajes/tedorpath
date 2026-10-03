-- How a learner-facing price is written for each market.
--
-- `symbol` renders "$20"; `code` renders "1,500 ETB". The two shipped markets need
-- opposite answers — "$" is unambiguous everywhere, while "Br" is shared with
-- Burundi's franc and tells an international reader nothing — so the choice is
-- recorded beside the currency rather than inferred from the symbol.
--
-- Additive with a default, so no row has to be rewritten and the existing two
-- markets are set explicitly below.
ALTER TABLE "markets"
    ADD COLUMN "priceFormat" VARCHAR(10) NOT NULL DEFAULT 'symbol';

-- Ethiopia spells out the code; everywhere else the symbol is enough.
UPDATE "markets" SET "priceFormat" = 'code' WHERE "code" = 'ETB';
