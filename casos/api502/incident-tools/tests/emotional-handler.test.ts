import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectArchetype,
  getExposureLevel,
  ARCHETYPES,
  type ArchetypeKey,
} from "../src/emotional-handler.js";


describe("detectArchetype — SOUL.md Sección 4", () => {
  describe("Arquetipo: Colapsado", () => {
    it("detecta señales clásicas de colapso", () => {
      assert.equal(
        detectArchetype("Llevo 3 horas intentando esto y rompí todo, no sirve nada"),
        "colapsado",
      );
    });

    it("detecta mayúsculas + señales de socorro", () => {
      assert.equal(
        detectArchetype("LLEVO HORAS Y NADA FUNCIONA AYUDA SOCORRO"),
        "colapsado",
      );
    });

    it("detecta rendición + señales", () => {
      assert.equal(
        detectArchetype("Me rindo, llevo horas y no sirve nada"),
        "colapsado",
      );
    });
  });

  describe("Arquetipo: Hostil / Frustrado", () => {
    it("detecta insulto + recurrencia", () => {
      assert.equal(
        detectArchetype("Otra vez este error de mierda, nunca funciona"),
        "hostil",
      );
    });

    it("detecta porquería + siempre falla", () => {
      assert.equal(
        detectArchetype("Qué porquería de sistema, siempre falla"),
        "hostil",
      );
    });

    it("detecta basura", () => {
      assert.equal(
        detectArchetype("Este servicio es una basura"),
        "hostil",
      );
    });
  });

  describe("Arquetipo: Novato perdido", () => {
    it("detecta no entiendo + soy nuevo", () => {
      assert.equal(
        detectArchetype("No entiendo qué significa este error, soy nuevo"),
        "novato",
      );
    });

    it("detecta no sé + ayuda por favor", () => {
      assert.equal(
        detectArchetype("No sé cómo funciona esto, ayuda por favor"),
        "novato",
      );
    });

    it("detecta primera vez + no entiendo", () => {
      assert.equal(
        detectArchetype("Es mi primera vez y no entiendo nada"),
        "novato",
      );
    });
  });

  describe("Arquetipo: Senior técnico", () => {
    it("detecta traceback + pool + timeout", () => {
      assert.equal(
        detectArchetype("Tengo 500 en checkout. Traceback dice timeout a Redis. Pool config?"),
        "senior",
      );
    });

    it("detecta gateway + heap + GC", () => {
      assert.equal(
        detectArchetype("El gateway devuelve 504, revisa el heap dump y el GC log"),
        "senior",
      );
    });

    it("detecta null pointer + race condition", () => {
      assert.equal(
        detectArchetype("Null pointer en el handler, posible race condition en el pool"),
        "senior",
      );
    });
  });

  describe("Arquetipo: Impaciente (PM/CEO)", () => {
    it("detecta cuánto tarda + perdiendo dinero + urgente", () => {
      assert.equal(
        detectArchetype("¿Cuánto tarda? Estamos perdiendo dinero, esto es urgente"),
        "impaciente",
      );
    });

    it("detecta ya + stakeholder", () => {
      assert.equal(
        detectArchetype("Necesito esto ya, los stakeholder están esperando"),
        "impaciente",
      );
    });

    it("detecta rápido + producción", () => {
      assert.equal(
        detectArchetype("Rápido, esto va a producción hoy"),
        "impaciente",
      );
    });
  });

  describe("Arquetipo: Culposo / Ansioso", () => {
    it("detecta ¿fui yo? + ¿lo hice mal?", () => {
      assert.equal(
        detectArchetype("¿Fui yo? ¿Lo hice mal? Tengo miedo de haber roto algo"),
        "culposo",
      );
    });

    it("detecta me equivoqué + ¿rompí?", () => {
      assert.equal(
        detectArchetype("Me equivoqué, ¿rompí la base de datos?"),
        "culposo",
      );
    });

    it("detecta soy un desastre + la arruiné", () => {
      assert.equal(
        detectArchetype("Soy un desastre, la arruiné toda"),
        "culposo",
      );
    });
  });

  describe("Arquetipo: Neutro (sin señales claras)", () => {
    it("devuelve null para mensaje genérico sin señales", () => {
      assert.equal(
        detectArchetype("El endpoint devuelve error"),
        null,
      );
    });

    it("devuelve null para mensaje mínimo", () => {
      assert.equal(
        detectArchetype("Hola"),
        null,
      );
    });
  });
});


describe("getExposureLevel — SOUL.md Sección 3", () => {
  it("retry 1 → incipiente (level 1)", () => {
    const result = getExposureLevel(1);
    assert.equal(result.level, 1);
    assert.equal(result.label, "incipiente");
  });

  it("retry 2 → incipiente (level 1)", () => {
    assert.equal(getExposureLevel(2).level, 1);
  });

  it("retry 3 → friccion (level 2)", () => {
    const result = getExposureLevel(3);
    assert.equal(result.level, 2);
    assert.equal(result.label, "friccion");
  });

  it("retry 5 → friccion (level 2)", () => {
    assert.equal(getExposureLevel(5).level, 2);
  });

  it("retry 6 → cronica (level 3)", () => {
    const result = getExposureLevel(6);
    assert.equal(result.level, 3);
    assert.equal(result.label, "cronica");
  });

  it("retry 20 → cronica (level 3)", () => {
    assert.equal(getExposureLevel(20).level, 3);
  });

  it("retry 0 → incipiente (level 1, edge case)", () => {
    assert.equal(getExposureLevel(0).level, 1);
  });
});


describe("ARCHETYPES — integridad de definiciones", () => {
  const expectedKeys: ArchetypeKey[] = ["colapsado", "hostil", "novato", "senior", "impaciente", "culposo"];

  for (const key of expectedKeys) {
    it(`archetype "${key}" tiene signals, needs, tone y promptDirective`, () => {
      const archetype = ARCHETYPES[key];
      assert.ok(archetype.signals.length > 0, `signals vacías en ${key}`);
      assert.ok(archetype.needs.length > 0, `needs vacío en ${key}`);
      assert.ok(archetype.tone.length > 0, `tone vacío en ${key}`);
      assert.ok(archetype.promptDirective.length > 0, `promptDirective vacío en ${key}`);
    });
  }
});
