import { describe, it, expect } from "vitest";
import { parseCSVText, parseCSVImport, sanitizeCSVField, deriveUsername } from "./csvImport";

describe("sanitizeCSVField", () => {
  it("should strip leading = character", () => {
    expect(sanitizeCSVField("=SUM(A1)")).toBe("SUM(A1)");
  });

  it("should strip leading + character", () => {
    expect(sanitizeCSVField("+cmd")).toBe("cmd");
  });

  it("should strip leading - character", () => {
    expect(sanitizeCSVField("-cmd")).toBe("cmd");
  });

  it("should strip leading @ character", () => {
    expect(sanitizeCSVField("@mention")).toBe("mention");
  });

  it("should leave normal strings unchanged", () => {
    expect(sanitizeCSVField("Juana Molina")).toBe("Juana Molina");
  });

  it("should handle empty string", () => {
    expect(sanitizeCSVField("")).toBe("");
  });

  it("should trim whitespace", () => {
    expect(sanitizeCSVField("  Stereolab  ")).toBe("Stereolab");
  });

  it("should strip formula prefix then trim", () => {
    expect(sanitizeCSVField("= dangerous ")).toBe("dangerous");
  });
});

describe("deriveUsername", () => {
  it("should extract local part from email", () => {
    expect(deriveUsername("jmolina@unc.edu")).toBe("jmolina");
  });

  it("should handle email with dots in local part", () => {
    expect(deriveUsername("j.molina@unc.edu")).toBe("j.molina");
  });

  it("should handle email with plus in local part", () => {
    expect(deriveUsername("jmolina+test@unc.edu")).toBe("jmolina+test");
  });
});

describe("parseCSVText", () => {
  it("should parse basic comma-separated values", () => {
    const result = parseCSVText("a,b,c\n1,2,3");
    expect(result).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("should handle quoted fields containing commas", () => {
    const result = parseCSVText('a,"b,c",d');
    expect(result).toEqual([["a", "b,c", "d"]]);
  });

  it("should handle escaped double quotes inside quoted fields", () => {
    const result = parseCSVText('a,"say ""hello""",c');
    expect(result).toEqual([["a", 'say "hello"', "c"]]);
  });

  it("should handle empty fields", () => {
    const result = parseCSVText("a,,c");
    expect(result).toEqual([["a", "", "c"]]);
  });

  it("should handle CRLF line endings", () => {
    const result = parseCSVText("a,b\r\n1,2");
    expect(result).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("should handle trailing newline without producing empty row", () => {
    const result = parseCSVText("a,b\n1,2\n");
    expect(result).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("should handle single row (header only)", () => {
    const result = parseCSVText("Name,Email");
    expect(result).toEqual([["Name", "Email"]]);
  });

  it("should handle newlines inside quoted fields", () => {
    const result = parseCSVText('a,"line1\nline2",c');
    expect(result).toEqual([["a", "line1\nline2", "c"]]);
  });

  it("should handle empty input", () => {
    const result = parseCSVText("");
    expect(result).toEqual([]);
  });
});

describe("parseCSVImport", () => {
  const validCSV = [
    "Name,Username,DJ Name,Email",
    "Juana Molina,jmolina,DJ Juana,juana@wxyc.org",
    "Cat Power,cpower,DJ Cat,cat@wxyc.org",
  ].join("\n");

  it("should parse valid CSV with all fields", () => {
    const result = parseCSVImport(validCSV);

    expect(result.rows).toEqual([
      { name: "Juana Molina", username: "jmolina", djName: "DJ Juana", email: "juana@wxyc.org" },
      { name: "Cat Power", username: "cpower", djName: "DJ Cat", email: "cat@wxyc.org" },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("should derive username from email when username is empty", () => {
    const csv = "Name,Username,DJ Name,Email\nJuana Molina,,DJ Juana,juana@wxyc.org";
    const result = parseCSVImport(csv);

    expect(result.rows[0].username).toBe("juana");
    expect(result.errors).toEqual([]);
  });

  it("should derive username from email when username column is absent", () => {
    const csv = "Name,DJ Name,Email\nJuana Molina,DJ Juana,juana@wxyc.org";
    const result = parseCSVImport(csv);

    expect(result.rows[0].username).toBe("juana");
    expect(result.errors).toEqual([]);
  });

  describe("header matching", () => {
    it.each([
      ["Name", "name"],
      ["First and Last Name", "first and last name"],
      ["Full Name", "full name"],
      ["FULL NAME", "full name (uppercase)"],
    ])("should match name column header: %s", (header) => {
      const csv = `${header},DJ Name,Email\nJuana Molina,DJ Juana,juana@wxyc.org`;
      const result = parseCSVImport(csv);

      expect(result.rows[0].name).toBe("Juana Molina");
    });

    it.each([
      ["DJ Name", "dj name"],
      ["DJ_Name", "dj_name"],
      ["djname", "djname"],
      ["Dj Name", "Dj Name"],
    ])("should match DJ name column header: %s", (header) => {
      const csv = `Name,${header},Email\nJuana Molina,DJ Juana,juana@wxyc.org`;
      const result = parseCSVImport(csv);

      expect(result.rows[0].djName).toBe("DJ Juana");
    });

    it.each([
      ["Email", "email"],
      ["EMAIL", "email (uppercase)"],
      ["email address", "email address"],
      ["Email Address", "Email Address"],
    ])("should match email column header: %s", (header) => {
      const csv = `Name,DJ Name,${header}\nJuana Molina,DJ Juana,juana@wxyc.org`;
      const result = parseCSVImport(csv);

      expect(result.rows[0].email).toBe("juana@wxyc.org");
    });

    it.each([
      ["Username", "username"],
      ["USERNAME", "username (uppercase)"],
      ["User Name", "user name"],
      ["Username (Optional)", "Username (Optional)"],
    ])("should match username column header: %s", (header) => {
      const csv = `Name,${header},DJ Name,Email\nJuana Molina,jmolina,DJ Juana,juana@wxyc.org`;
      const result = parseCSVImport(csv);

      expect(result.rows[0].username).toBe("jmolina");
    });
  });

  describe("validation", () => {
    it("should report error when name is empty", () => {
      const csv = "Name,DJ Name,Email\n,DJ Juana,juana@wxyc.org";
      const result = parseCSVImport(csv);

      expect(result.errors).toEqual([
        expect.objectContaining({ row: 1, field: "name" }),
      ]);
    });

    it("should report error when DJ name is empty", () => {
      const csv = "Name,DJ Name,Email\nJuana Molina,,juana@wxyc.org";
      const result = parseCSVImport(csv);

      expect(result.errors).toEqual([
        expect.objectContaining({ row: 1, field: "djName" }),
      ]);
    });

    it("should report error when email is empty", () => {
      const csv = "Name,DJ Name,Email\nJuana Molina,DJ Juana,";
      const result = parseCSVImport(csv);

      expect(result.errors).toEqual([
        expect.objectContaining({ row: 1, field: "email" }),
      ]);
    });

    it("should report error for invalid email format", () => {
      const csv = "Name,DJ Name,Email\nJuana Molina,DJ Juana,not-an-email";
      const result = parseCSVImport(csv);

      expect(result.errors).toEqual([
        expect.objectContaining({ row: 1, field: "email", message: expect.stringContaining("invalid") }),
      ]);
    });

    it("should detect duplicate emails across rows", () => {
      const csv = [
        "Name,DJ Name,Email",
        "Juana Molina,DJ Juana,juana@wxyc.org",
        "Cat Power,DJ Cat,juana@wxyc.org",
      ].join("\n");
      const result = parseCSVImport(csv);

      expect(result.errors).toEqual([
        expect.objectContaining({ row: 2, field: "email", message: expect.stringContaining("Duplicate") }),
      ]);
    });

    it("should report multiple errors on the same row", () => {
      const csv = "Name,DJ Name,Email\n,,";
      const result = parseCSVImport(csv);

      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      expect(result.errors.every((e) => e.row === 1)).toBe(true);
    });

    it("should still include rows with errors in the rows array", () => {
      const csv = "Name,DJ Name,Email\n,DJ Juana,juana@wxyc.org";
      const result = parseCSVImport(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].djName).toBe("DJ Juana");
    });
  });

  it("should strip formula-injection prefixes from field values", () => {
    const csv = "Name,DJ Name,Email\n=Juana Molina,+DJ Juana,juana@wxyc.org";
    const result = parseCSVImport(csv);

    expect(result.rows[0].name).toBe("Juana Molina");
    expect(result.rows[0].djName).toBe("DJ Juana");
  });

  it("should return empty rows for header-only CSV", () => {
    const csv = "Name,DJ Name,Email";
    const result = parseCSVImport(csv);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("should ignore extra columns", () => {
    const csv = "Name,DJ Name,Email,Favorite Color\nJuana Molina,DJ Juana,juana@wxyc.org,Blue";
    const result = parseCSVImport(csv);

    expect(result.rows[0]).toEqual({
      name: "Juana Molina",
      username: "juana",
      djName: "DJ Juana",
      email: "juana@wxyc.org",
    });
  });

  it("should report error when required header columns are missing", () => {
    const csv = "Name,Email\nJuana Molina,juana@wxyc.org";
    const result = parseCSVImport(csv);

    expect(result.errors).toEqual([
      expect.objectContaining({ row: 0, field: "header", message: expect.stringContaining("DJ Name") }),
    ]);
    expect(result.rows).toEqual([]);
  });
});
