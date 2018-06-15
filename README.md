# Gameboy 2 Assembly (gb2a)

**Instructions:**

Not a command line module right now.

Place the rom file, the sym file, and the shim file in the same directory as 'index.js'.

Modify the options in index.js as needed

Then open the command line the directory, and simply execute:

```
node index
```

This will create an output.asm file containing the parsed routines, which is formatted to work immediately with RGBDS.

It will also create a shim.sym file, which is a duplicate of the input shim.sym file, but will also include any additional pointers encountered during the disassembly process.

After, you can simply move the output.asm into the rom source repository in the desired location, and replace the previous shim.sym with the new shim.sym. Then simply run `make` to build the rom using RGBDS, and it should *hopefully* build properly.

_NOTE:_ Some RAM variables might not appear in the sym file, so you might get an RGBDS error saying it was unable to create the new RAM pointer (because it already has a value at that address)

If this happens, delete the new address (created by this disassembler) from the shim file, and rename the variable in the output.asm to the correct variable name in the corresponding (v/s/w/h)ram.asm file.

# Inputs

**- rom** | String, _required_

The path to the rom file

---

**- loc** | Number/String/Bank Address, _required_

The location(s) in the ROM to parse (can be alone or in an array)

Values can be:
  * Number
    * The global address
  * String
    * The name of address in the provided Sym/Shim file
  * Bank Address 
    * Array of [Bank, Addr]
	  * Bank : Bank index as number
	  * Addr : In-bank address as number (0x0000 - 0x7FFF)

---

**- dir** | String

The directory to place the output files.

The disassembler will create 2 files:
  * One 'asm' file containing the disassembled routine
  * One 'sym' file containing the non-parsed addresses encountered during the disassembling

---

**- sym** | String

The path to the SymFile.

The disassembler will assume all pointers in the SymFile have already been parsed.

Therefor, it will not parse any data at those locations, unless explicity told to by the input locations

The output file will use these as the pointer names

_NOTE:_ Even if a routine is the SymFile, the disassembler might parse a portion of it if a to-parse location falls within the routine.

The disassembly has now way of knowing that it belongs to the routine in the SymFile, since the SymFile only lists the start address.

---

**- shim** | String

The path to the ShimFile.

The disassembler will assume all pointers in the SymFile have **NOT** already been parsed.

Therefor, it **WILL** parse any data at those locations.

The output file will use these as the pointer names

---

**- gen** | Number

The number of generations the disassembler should parse.

The input locations are the 0th generation.

All calls/jumps within those routines are the 1st generation, and so on.

Default is `0`

---

**- assumePtr** | Boolean

When a value is loaded into bc, de, or hl, the disassembler doesn't know if it is an address or a number.

This value will tell the disassembler to treat them as addresses (true) or numbers (false)

Default is `false`

---

**- minDataPtr** | Number

**- maxDataPtr** | Number

This is another way to tell the disaseembler when to treat an uncertain value as a number or an address.

Any values in between these numbers (inclusive) will be treated as addresses.

Any values outside will be treated as numbers.

---

**- homeRefBank** | Number

Bank switching is not considered during the disassembly process.

When a non-home address is referenced from the home bank, it will simply write the address as a number to the output file. (Unless the ROM itself only has 1 bank)

If this value is provided, the disassembler will instead assume that the address lies within the given bank.