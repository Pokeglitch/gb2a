let Table = require('./Table'),
	Address = require('./Address'),
	Ref = require('./Ref'),
	Warning = require('./Warning');

class TableParser {
	constructor( disassembly, addr ){
		this.disassembly = disassembly;
		this.addr = addr;
		
		// Pull some data from the disassembly
		this.ROM = disassembly.ROM;
		
		// Initialize the parser data
		this.index = addr;
		
		this.Head = this.Table = new Table(this, addr);
		
		// Begin parsing
		this.parse();
		
		this.finalize();
	}
	
	parse(){
		do {
			this.parsePointer();
		} while ( this.doContinue() )
	}
	
	parsePointer(){
		let addr = this.ROM[this.index++];
		addr += 0x100 * this.ROM[this.index++];
		
		this.Table.addContent(addr);
		this.disassembly.ROMRefs.set( addr, Ref.EXEC );
		this.disassembly.RoutinesToParse.add(addr);
	}
	
	// Don't continue if end of bank or encountering a known address
	doContinue(){
		if( !(this.index % 0x4000) ){
			Warning(`End of bank reached while parsing string at ${ Address.toBankString(this.addr, 'rom') }`);
			return false;
		}
	
		if( this.disassembly.ROMRefs.has(this.index) ){
			return false;
		}
		
		return true;
	}
	
	finalize(){
		this.Table.close( this.index );
		this.Head.store();
	}
}

module.exports = TableParser;