let fs = require('fs'),
	Ref = require('./Ref'),
	Address = require('./Address'),
	Warning = require('./Warning'),
	OrderedList = require('./OrderedList'),
	RoutineParser = require('./RoutineParser'),
	TextParser = require('./TextParser'),
	DataParser = require('./DataParser'),
	TableParser = require('./TableParser');

class Disassembler {
	constructor({ rom, asm, data, dir, overwrite, sym, shim, charmap, eos, text, table, gen, assumePtr, minDataPtr, maxDataPtr, homeRefBank, useRAMoffset }){
		
		// List of all references/address in RAM
		this.RAMRefs = new Ref.Map();
		
		// List of all references/address in ROM
		this.ROMRefs = new Ref.Map();
		
		// List of all routines/strings which have been parsed
		this.ParsedRoutines = new OrderedList( asm => asm.addr );
		this.ParsedTexts = new OrderedList( text => text.addr );
		this.ParsedTables = new OrderedList( table => table.addr );
		this.ParsedData = new OrderedList( data => data.addr );
		this.ParsedContent = new OrderedList( c => c.addr );
		
		// List of all names which are in the shim, but the address appears in the sym with a different name
		this.ShimOnlyROMNames = new Map();
		this.ShimOnlyRAMNames = new Map();
		
		// Input arguments:
		try{
			this.ROM = fs.readFileSync( rom );
		}
		catch(e){
			Warning("Unable to load ROM from '" + rom + "'");
			return;
		}
		
		this.num_banks = this.ROM.length / 0x4000;
		
		// The rom is corrupted if the number of banks is not an integer
		if( this.num_banks % 1 ){
			Warning("ROM is not valid");
			return;
		}
		
		this.ByteToChar = new Map;
		this.CharToByte = new Map;
		
		if( typeof charmap === 'string' ){
			this.importCharMap( charmap );
		}
		
		// End of string
		this.EOS = new Set;
		
		[].concat(eos).forEach( val => {
			if( typeof val === 'string' && this.CharToByte.has(val) ){
				this.EOS.add( this.CharToByte.get(val) );
			}
			else if( typeof val === 'number' && this.ByteToChar.has(val) ){
				this.EOS.add(val);
			}
		});
		
		// Test shim first, since any value in shim will also appear in sym
		if( typeof shim === 'string' ){
			this.importSym( shim, Ref.DATA );
		}
		if( typeof sym === 'string' ){
			this.importSym( sym, Ref.MAIN );
		}
		
		// Begin tracking which refs were discovered during disassembly
		this.ROMRefs.beginTracking();
		this.RAMRefs.beginTracking();
		
		// The bank to use for non-home bank pointers found in the home bank
		this.homeRefBank = (typeof homeRefBank === 'number' && 0 <= homeRefBank && homeRefBank < this.num_banks ) ?
			homeRefBank :
			// If there is only 1 non-home bank, then set that as the reference bank
			this.num_banks === 2 ?
				1 :
				0;
		
		// List of all content which still need to be parsed
		this.ContentToParse = new Set();
		this.DataToParse = this.importLocations(data);
		this.RoutinesToParse = this.importLocations(asm);
		this.StringsToParse = this.importLocations(text);
		this.TablesToParse = this.importLocations(table);
		
		this.assumePtr = assumePtr === true;
		this.useRAMoffset = useRAMoffset === true;
		
		this.minDataPtr = (typeof minDataPtr === 'number' && 0 <= minDataPtr <= this.ROM.length) ? minDataPtr : 0;
		this.maxDataPtr = (typeof maxDataPtr === 'number' && 0 <= maxDataPtr <= this.ROM.length) ? maxDataPtr : this.ROM.length;
		
		// Initialize the generation tracker
		this.current_gen = 0;
		this.max_gen = typeof gen === 'number' && 0 <= gen ? gen : 0;
		this.next_gen_start_index = this.RoutinesToParse.size;
		this.current_parse_index = 0;
		
		this.parseStrings();
		this.parseTables();
		this.parseData();
		this.parseRoutines();
		
		// Compile
		this.compile( dir, overwrite === true );
	}
	
	// Checks whether the input is a valid Bank/Address combo
	isValidAddress( arr ){
		let [bank, addr] = arr;
		
		// Make sure bank/addr are integers, and that only 2 elements are in the array
		if( arr.length === 2 && typeof bank === 'number' && bank % 1 === 0 && typeof addr === 'number' && addr % 1 === 0 ){
			if( bank === 0 ){
				return 0 <= addr && addr < 0x4000;
			}
			else if( 0 < bank && bank < this.num_banks ){
				return 0x4000 <= addr && addr < 0x8000;
			}
		}
		
		return false;
	}
	
	// To import the char map
	importCharMap( path ){
		try{
			var data = fs.readFileSync( path, 'utf8' );
		}
		catch(e){
			Warning("Unable to load charmap from '" + path + "'");
			return;
		}
		
		let lines = data.split(/[\r\n]+/);
		
		for(let i = 0; i < lines.length; i ++ ){
			let match = lines[i].split(';')[0].match(/^\s*charmap\s*"((?:[^"\\]|\\.)*)"\s*,\s*([^\s]+)\s*$/i);
			
			// If there was no match
			if( !match ){
				continue;
			}
			
			let str = match[1],
				value = match[2].charAt(0) === '$' ?
					parseInt( match[2].slice(1), 16 ) :
					parseInt( match[2] );
					
			if( this.ByteToChar.has(value) ){
				Warning("Chars " + this.ByteToChar.get(value) + " and " + str + " both share byte " + match[2]);
			}
			else{
				this.ByteToChar.set( value, str );
				this.CharToByte.set( str, value );
			}
		}
	}
	
	// To validate the starting locations
	importLocations( loc ){
		let input = [].concat( loc ),
			output = new Set,
			add = x => {
				output.add(x);
				this.ROMRefs.set(x, Ref.DATA);
				this.ContentToParse.add(x);
			};
		
		// See if the input was a single address/bank
		if( this.isValidAddress(input) ){
			add( Address.toGlobal(...input) );
		}
		else{
			// Otherwise, validate each element
			input.forEach( val => {
				if( typeof val === 'number' && val % 1 === 0 && 0 <= val && val < this.ROM.length ){
					add( val );
				}
				else if( typeof val === 'string' && this.ROMRefs.NameToIndex.has(val) ){
					add( this.ROMRefs.NameToIndex.get(val) )
				}
				else if( val instanceof Array && this.isValidAddress(val) ){
					add( Address.toGlobal(...val) );
				}
			})
		}
		
		return output;
	}
	
	// To import a sym file
	importSym( path, type ){
		try{
			var sym = fs.readFileSync( path, 'utf8' );
		}
		catch(e){
			Warning("Unable to load sym file from '" + path + "'");
			return;
		}
		
		let lines = sym.split(/[\r\n]+/);
		
		for(let i = 0; i < lines.length; i ++ ){
			let match = lines[i].match(/^([\dabcdef]{2}:[\dabcdef]{4})\s+([^\s]+).*$/i);
			
			// If there was no match
			if( !match ){
				continue;
			}
			
			let index = Address.parse( match[1] ),
				name = match[2];
			
			if( index.type === 'ram' ){
					
				let names = this.RAMRefs.getLink(index.addr),
					prev_type = this.RAMRefs.get( index.addr );
					
				// If it's a new name, then add
				if( names.indexOf(name) < 0 ){
					// If upgrading from shim to sym, preserve the name list which appeared in the shim
					if( names.length && prev_type !== type ){
						this.ShimOnlyRAMNames.set( index.addr, names.slice() );
					}
					this.RAMRefs.link( name, index.addr );
					this.RAMRefs.set( index.addr, type );
				}
			}
			else{
					
				let names = this.ROMRefs.getLink(index.addr),
					prev_type = this.ROMRefs.get( index.addr );
					
				// If it's a new name, then add
				if( names.indexOf(name) < 0 ){
					// If upgrading from shim to sym, preserve the name list which appeared in the shim
					if( names.length && prev_type !== type ){
						this.ShimOnlyROMNames.set( index.addr, names.slice() );
					}
					
					this.ROMRefs.link( name, index.addr );
					this.ROMRefs.set( index.addr, type );
				}
			}
		}
	}
	
	// To upgrade an external node to a main node
	upgradeExternal( addr ){
		for( let rt of this.ParsedRoutines ){
			// Skip the main node, since its already a Main
			rt = rt.next;
			
			while( rt ){				
				if( addr === rt.addr ){
					rt.upgrade();
					return;
				}
				
				rt = rt.next;
			}
		}
	}

	// To try to split a node at the given address
	trySplitExternal( addr, type, index ){
		for( let rt of this.ParsedRoutines ){
			// If the address is earlier than the start of the routine, then exit
			if( addr < rt.addr ){
				break;
			}
			
			let tail = rt.getTail();
			
			// If the address is earlier than the tail after address, then this routine chain contains the address
			if( addr < tail.after_addr ){
				// Get the newly split node (starting from the tail)
				let node = tail.split( addr, type, index );
				
				if( node ){
					node.upgrade();
				}
				// If no node was found, then this points to an intra-opcode address, so store as faulty
				else{
					this.ROMRefs.setFaulty( addr, type );
				}
				
				return true;
			}
		}
		
		return false;
	}
	
	// To get the name for the given address (rom or ram) either as array or as a string
	getName( addr, type, asArray ){
		if( type === 'ram' ){
			if( this.RAMRefs.IndexToName.has(addr) ){
				let list = this.RAMRefs.IndexToName.get(addr);
				
				return asArray ? list : list[0];
			}
			
			if( this.useRAMoffset ){
				// Get the previous ram position
				let prev = this.RAMRefs.findPrev(addr);
				
				if( prev ){
					let name = `${prev.name}+${addr - prev.addr}`;
					return asArray ? [name] : name;
				}
			}
			
			let name = '';
			
			// If a name still doesnt exist (useRAMoffset == false or there is no earlier RAM position) then create a new name
			switch( this.RAMRefs.get(addr) ){
				case Ref.MAYBE:
					if( this.isMaybeANumber(addr) ){
						name = Address.toHexString( addr, type );
						Warning('Potential address ' + Address.toBankString( addr, type ) + ' reverted to number.');
						break;
					}
				case Ref.DATA:
				case Ref.EXEC:
					let str 
					if( addr < 0xA000 ){
						name = 'v' + Address.format( addr, 4 );
					}
					else if( addr < 0xC000 ){
						name = 's' + Address.format( addr, 4 );
					}
					else if( addr < 0xE000 ){
						name = 'w' + Address.format( addr, 4 );
					}
					else if( 0xFE00 <= addr && addr < 0xFEA0 ){
						name = 'o' + Address.format( addr, 4 );
					}
					else if( 0xFF00 <= addr && addr < 0xFF80 ){
						name = 'r' + Address.format( addr, 4 );
					}
					else if( 0xFF80 <= addr && addr < 0xFFFF ){
						name = 'h' + Address.format( addr, 4 );
					}
					else{
						name = 'ram_' + Address.format( addr, 4 );
					}
			}
			
			// Don't store the name if we are using ram offset
			if( !this.useRAMoffset ){
				this.RAMRefs.link( name, addr );
			}
			return asArray ? [name] : name;
		}
		else{
			if( this.ROMRefs.IndexToName.has(addr) ){
				let list = this.ROMRefs.IndexToName.get(addr);
				return asArray ? list : list[0];
			}
			else{
				let ref_type = this.ROMRefs.get(addr),
					name = '';
				
				switch( ref_type ){
					case Ref.FAULTY_MAYBE:
						name = Address.toHexString( addr, type );
						break;
					case Ref.MAYBE:
						if( this.isMaybeANumber(addr) ){
							Warning('Potential address ' + Address.toBankString( addr, type ) + ' reverted to number.');
							name = Address.toHexString( addr, type );
							break;
						}
					case Ref.DATA:
						let content = this.ParsedContent.has(addr),
							prefix = content ?
								content.type :
								'Unknown';
								
						name = prefix + Address.format( addr, 4 );
						break;
					case Ref.FAULTY_DATA:
						name = 'Unknown' + Address.format( addr, 4 );
						break;
					case Ref.SUB:
						name = '.sub_' + Address.format( addr, 4 );
						break;
					case Ref.EXEC:
					case Ref.MAIN:
					case Ref.FAULTY_EXEC:
						name = 'Function' + Address.format( addr, 4 );
						break;
				}
				
				this.ROMRefs.link( name, addr );
				return asArray ? [name] : name;
			}
		}
	}
	
	// To begin the disassembly process
	parseRoutines(){
		// Go through each address in the RoutinesToParse set
		// This set is updated after each routine is parsed
		for( let addr of this.RoutinesToParse ){
		
			// If the current generation is finished, then update the generation count and next generation start index
			if( this.current_parse_index === this.next_gen_start_index ){
				this.current_gen++;
				this.next_gen_start_index = this.RoutinesToParse.size;
			}
			
			// Exit if it exceeded the max gen
			if( this.current_gen > this.max_gen ){
				break;
			}
			
			// Increase the current parse count
			this.current_parse_index++
		
			// Get the type
			let external_type = this.ROMRefs.get( addr );
			
			// Don't parse if the address has already been parsed
			if( external_type === Ref.MAIN ){
				// Unless explicitly directed to from the inputs
				if( this.current_gen === 0 && !this.ParsedRoutines.has(addr) ){
					// Execute the RoutineParser
					new RoutineParser( this, addr );
				}
				else{
					continue;
				}
			}
		
			// If the address is a faulty address, then don't parse
			else if( Ref.isFaulty(external_type) ){
				continue;
			}
			
			// Upgrade if a sub routine
			else if( external_type === Ref.SUB ){
				this.upgradeExternal( addr )
				continue;
			}
			// Try to split a routine
			else if( this.trySplitExternal( addr, Ref.EXEC, null ) ){
				continue;
			}
			// Otherwise, see if it collides with anything already parsed
			else{
				// Note: Already handled parsed routine splitting/upgrades
				let node = this.ParsedContent.contains(addr);
				
				if( node ){
					Warning(`Cannot parse routine at ${ Address.toBankString(addr, 'rom') } because a ${ node.type } has already been parsed at that location`);
					continue;
				}
				else{
					// Execute the RoutineParser
					new RoutineParser( this, addr );
				}
			}
		}
	}
	
	parseTables(){
		for(let addr of this.TablesToParse){
			let node = this.ParsedContent.contains(addr);
			// If already parsed:
			if( node ){
				// If it's a table node
				if( node.type === 'Table' ){
					// Split if the node start address is not the same as this address
					if( node.addr !== addr ){
						node.split(addr);
					}
				}
				// If not text, then warning
				else{
					Warning(`Cannot parse table at ${ Address.toBankString(addr, 'rom') } because a ${ node.type } has already been parsed at that location`);
				}
			}
			// Otherwise, parse
			else{
				new TableParser( this, addr );
			}
		}
	}
	
	parseData(){
		for(let addr of this.DataToParse){
			let node = this.ParsedContent.contains(addr);
			// If already parsed:
			if( node ){
				// If it's a data node
				if( node.type === 'Data' ){
					// Split if the node start address is not the same as this address
					if( node.addr !== addr ){
						node.split(addr);
					}
				}
				// If not text, then warning
				else{
					Warning(`Cannot parse data at ${ Address.toBankString(addr, 'rom') } because a ${ node.type } has already been parsed at that location`);
				}
			}
			// Otherwise, parse
			else{
				new DataParser( this, addr );
			}
		}
	}
	
	parseStrings(){
		for( let addr of this.StringsToParse ){
			let node = this.ParsedContent.contains(addr);
			// If already parsed:
			if( node ){
				// If it's a text node
				if( node.type === 'Text' ){
					// Split if the node start address is not the same as this address
					if( node.addr !== addr ){
						node.split(addr);
					}
				}
				// If not text, then warning
				else{
					Warning(`Cannot parse text at ${ Address.toBankString(addr, 'rom') } because a ${ node.type } has already been parsed at that location`);
				}
			}
			// Otherwise, parse
			else{
				new TextParser( this, addr );
			}
		}
	}
	
	// Returns true if the given address should be treated as a number
	isMaybeANumber( addr ){
		return !this.assumePtr || addr < this.minDataPtr || addr > this.maxDataPtr;
	}
	
	compile( dir = 'outdir', overwrite ){
		let postfix = 0,
			outDir = dir;
		
		while( true ){
			// Try to create the directory until one works
			try{
				fs.mkdirSync(outDir);
				break;
			}
			catch(e){
				// If there was an error in creating the directory that wasnt due to an aleady existing directory, then exit
				if( !e.message.startsWith('EEXIST') ){
					Warning("Error creating output directory: '" + outDir + "'");
					return;
				}
				// If it was due to an existing directory, but overwrite is permitted, then break
				else if( overwrite ){
					break;
				}
				postfix++;
				outDir = dir + postfix;
			}
		}
	
		try{
			var asm = fs.createWriteStream( outDir + '/output.asm' );
		}
		catch(e){
			Warning("Error creating output file: '" + outDir + "'/output.asm'");
			return;
		}
		
		// Traverse the parsed routines
		let prev_after_addr = null;
	
		for( let content of this.ParsedContent ){
		
			// Section Header of the previous content's "after address" doesn't match this routines start address:
			if( content.addr !== prev_after_addr ){
				if( prev_after_addr ){
					asm.write(`; ${ Address.toBankString( prev_after_addr, 'rom' ) }\n\n`);
				}
			
				let [bank, addr] = Address.toBankString( content.addr, 'rom' ).split(':')
				
				asm.write( 'SECTION "' + this.getName( content.addr, 'rom' ) + '", ' );
				
				if( bank === '00' ){
					asm.write( 'ROM0[$' + addr + ']' );
				}
				else{
					asm.write('ROMX[$' + addr + '], BANK[$' + bank + ']');
				}
				
				asm.write('\n\n');
			}
		
			// Update the "previous after address"
			prev_after_addr = content.getNextAddr();
			
			// Compile the content
			content.compile( this, asm );
			
			// Add a line break
			asm.write( '\n' );
		}
		
		
		if( prev_after_addr ){
			asm.write(`; ${ Address.toBankString( prev_after_addr, 'rom' ) }\n\n`);
		}
		
		asm.end();
		
		// Create the shim file
		let rom_shim = new OrderedList( x => x.addr ),
			ram_shim = new OrderedList( x => x.addr ),
			new_rom_shim = new OrderedList( x => x.addr ),
			new_ram_shim = new OrderedList( x => x.addr );
		
		// Capture the necessary ROM addresses
		for(let [addr,type] of this.ROMRefs){
			if( this.ParsedContent.has(addr) ){
				continue;
			}
			switch( type ){
				case Ref.MAYBE:
					if( this.isMaybeANumber(addr) ){
						break;
					}
				case Ref.DATA:
				case Ref.EXEC:
				case Ref.FAULTY_DATA:
				case Ref.FAULTY_EXEC:
					var name = this.getName( addr, 'rom', true ),
						isNew = this.ROMRefs.isNew(addr);
					
					name.forEach( x => {
						let str = Address.toBankString( addr, 'rom' ) + ' ' + x;
						rom_shim.add({ addr, str });
						
						if(isNew){
							new_rom_shim.add({ addr, str });
						}
					});
			}
		}
		
		for(let [addr,names] of this.ShimOnlyROMNames ){
			names.forEach( x => {
				let str = Address.toBankString( addr, 'rom' ) + ' ' + x;
				rom_shim.add({ addr, str });
			});
		}
		
		// Capture the necessary RAM addresses
		for(let [addr,type] of this.RAMRefs){
			switch( type ){
				case Ref.MAYBE:
					if( this.isMaybeANumber(addr) ){
						break;
					}
				case Ref.DATA:
				case Ref.EXEC:
					let name = this.getName( addr, 'ram', true ),
						isNew = this.RAMRefs.isNew(addr);
					
					name.forEach( x => {
						let str = Address.toBankString( addr, 'ram' ) + ' ' + x;
						ram_shim.add({ addr, str });
						
						if(isNew){
							new_ram_shim.add({ addr, str });
						}
					});
			}
		}
		
		
		for(let [addr,names] of this.ShimOnlyRAMNames ){
			names.forEach( x => {
				let str = Address.toBankString( addr, 'ram' ) + ' ' + x;
				ram_shim.add({ addr, str });
			});
		}
		
		// Write the shim file
		try{
			var out_shim = fs.createWriteStream( outDir + '/shim.sym' );
		}
		catch(e){
			Warning("Error creating output file: '" + outDir + "'/shim.sym'");
			return;
		}
		
		for( let { str } of rom_shim ){
			out_shim.write( str + '\n' );
		}
		
		for( let { str } of ram_shim ){
			out_shim.write( str + '\n' );
		}
		
		out_shim.end();
		
		// Write the new_shim_only file
		try{
			var out_new_shim = fs.createWriteStream( outDir + '/new_shim_only.sym' );
		}
		catch(e){
			Warning("Error creating output file: '" + outDir + "'/new_shim_only.sym'");
			return;
		}
		
		for( let { str } of new_rom_shim ){
			out_new_shim.write( str + '\n' );
		}
		
		for( let { str } of new_ram_shim ){
			out_new_shim.write( str + '\n' );
		}
		
		out_new_shim.end();
		
		console.log("Successfully wrote files to '" + outDir + "' directory");
	}
}

module.exports = Disassembler;