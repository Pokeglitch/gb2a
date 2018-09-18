# Gameboy 2 Assembly (gb2a)

**Instructions:**

Not a command line module right now.

Modify the options in index.js as needed.

The input shim/sym/charmap/rom can be copied from the disaseembly directory, or directly refer to those files

Then open the command line the directory, and simply execute:

```
node index
```

This will create an output.asm file containing all of the extracted content, which is formatted to work immediately with RGBDS.

It will also create a shim.sym file, which is a duplicate of the input shim.sym file, but will also include any additional pointers encountered during the disassembly process.

It will also create new_shim_only.sym file, which only contains the new pointers that were added, for reference.

After, you can simply move the output.asm into the rom source repository in the desired location, and replace the previous shim.sym with the new shim.sym. Then simply run `make` to build the rom using RGBDS, and it should *hopefully* build properly.

_NOTE:_ Some RAM variables might not appear in the sym file, so you might get an RGBDS error saying it was unable to create the new RAM pointer (because it already has a value at that address)

If this happens, delete the new address (created by this disassembler) from the shim file, and rename the variable in the output.asm to the correct variable name in the corresponding (v/s/w/h)ram.asm file.

# Inputs

**- rom** | String, _required_

The path to the rom file

---

**- dir** | String

The directory to place the output files.

The disassembler will create 3 files:
  * One 'asm' file containing the disassembled routine
  * One 'sym' file containing the all non-parsed addresses (both old and new)
  * One 'sym' file for reference, containing only the newly encountered non-parsed addresses

---

**- overwrite** | String

Whether or not the output flie should overwrite any previously created files

If `false`, it will create a new directory with a number appended at the end if the original directory already exists

Default is `false`

---

**- sym** | String

The path to the SymFile.

The disassembler will assume all pointers in the SymFile have already been parsed (unless they are also in the ShimFile)

Therefor, it will not parse any data at those locations, unless explicity told to by the input locations

The output file will use these as the pointer names

_NOTE:_ Even if a routine is the SymFile, the disassembler might parse a portion of it if a to-parse location falls within the routine.

The disassembly has no way of knowing that it belongs to the routine in the SymFile, since the SymFile only lists the start address.

---

**- shim** | String

The path to the ShimFile.

The disassembler will assume all pointers in the SymFile have **NOT** already been parsed.

Therefor, it **WILL** parse any data at those locations.

The output file will use these as the pointer names

---

**- charmap** | String

The path to the CharMap file.  Uses the same format as rgbds.

The disassembler will use this when parsing Text to convert the byte values into characters.

The output chars can be of any length, but the input value must be a single byte.

It will stop parsing strings when it encounters a byte value that is not in this map

---

**- asm** | Number/String/Bank Address

The location(s) in the ROM to parse for ASM routines

Routines are written to the output file in the rgbds format

Values can be (alone or in an array):
  * Number
    * The global address
  * String
    * The name of address in the provided Sym/Shim file
  * Bank Address 
    * Array of [Bank, Addr]
	  * Bank : Bank index as number
	  * Addr : In-bank address as number (0x0000 - 0x7FFF)

---

**- text** | Number/String/Bank Address

The location(s) in the ROM to parse for Text

It will continue parsing until it reaches a known address, an `eos` symbol, or a value not in the charmap

Text is written to the output file as a string (a concatenation of all chars after converting from the byte value using the CharMap)

Values can be (alone or in an array):
  * Number
    * The global address
  * String
    * The name of address in the provided Sym/Shim file
  * Bank Address 
    * Array of [Bank, Addr]
	  * Bank : Bank index as number
	  * Addr : In-bank address as number (0x0000 - 0x7FFF)

---

**- table** | Number/String/Bank Address

The location(s) in the ROM to parse for tables

It will assume that the table is a jumptable, meaning all values are routine pointers.

It will continue parsing until it reaches a known address.

If you want to parse a table of pointers that aren't routines, set the `gen` input to 0.
Otherwise it will attempt to parse each pointer as a routine.

If you want to extract data that isn't a table of pointers, use the `data` input

Tables are written to the output file as a list of pointers

Values can be (alone or in an array):
  * Number
    * The global address
  * String
    * The name of address in the provided Sym/Shim file
  * Bank Address 
    * Array of [Bank, Addr]
	  * Bank : Bank index as number
	  * Addr : In-bank address as number (0x0000 - 0x7FFF)

---

**- data** | Number/String/Bank Address

The location(s) in the ROM to parse for raw data

It will continue parsing until it reaches a known address

Data is written to the output.asm file as 8-bit hex values

Values can be (alone or in an array):
  * Number
    * The global address
  * String
    * The name of address in the provided Sym/Shim file
  * Bank Address 
    * Array of [Bank, Addr]
	  * Bank : Bank index as number
	  * Addr : In-bank address as number (0x0000 - 0x7FFF)

---

**- gen** | Number

The number of assembly generations the disassembler should parse.

The input `asm` locations are the 0th generation.

All calls/jumps within those routines are the 1st generation, and so on.

All routines extracted from any input tables are considered 1st generation

Default is `0`

---

**- eos** | Number/String

The bytes or chars which represent the end of a string.

Can be a a single value or in an array.

If the input is a char, it must be in the charmap.

The string will stop parsing when this value is reached, and will include it in the string.

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

Bank switching is not detected during the disassembly process.

When a non-home address is referenced from the home bank, it will simply write the address as a number to the output file. (Unless the ROM itself only has 1 bank)

If this value is provided, the disassembler will instead assume that the address lies within the given bank.