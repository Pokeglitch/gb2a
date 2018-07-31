let Address = require('./Address'),
	Ref = require('./Ref'),
	Warning = require('./Warning');

class TableParser {
	constructor( disassembly, addr ){
		this.disassembly = disassembly;
		this.addr = addr;
		
		// Pull some data from the disassembly
		this.ROM = disassembly.ROM;
		this.index = addr;
		this.data = [];
		
		this.parse();
		
		this.after_addr = this.index;
	}
	
	// To have the same interface as Routine
	getTail(){
		return this;
	}
	
	parse(){
		do {
			this.parsePointer();
		} while ( this.doContinue() )
	}
	
	parsePointer(){
		let addr = this.ROM[this.index++];
		addr += 0x100 * this.ROM[this.index++];
		
		this.disassembly.ROMRefs.set( addr, Ref.EXEC );
		this.data.push(addr);
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
	
	compile( dis, asm ){
		let labels = dis.getName( this.addr, 'rom', true );
		
		labels.forEach( (x,i) => {
			let label = x + ':';
			if( i === 0 ){
				label += ' ; ' + Address.toBankString( this.addr, 'rom' );
			}
			asm.write( label + '\n' );
		})
		
		this.data.forEach( addr => asm.write( '\tdw ' + dis.getName(addr, 'rom') + '\n' ) );
	}
}

module.exports = TableParser;