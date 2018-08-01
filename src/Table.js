let Address = require('./Address');

class Table {
	constructor( parser, addr ){
		this.parser = parser;
		this.addr = addr;
		
		this.prefix = 'Table';
		
		// Initialize some data
		this.content = [];
	}
	
	addContent(ptr){
		this.content.push(ptr);
	}
	
	getNextAddr(){
		return this.after_addr;
	}
	
	split( addr ){
		let node = new Table( this.parser, addr );
		
		// A pointer is two bytes, so the index is the address different divided by 2
		node.content = this.content.splice( (addr - this.addr)/2 );
		node.close(this.after_addr);
		
		this.close( addr );
		
		node.store();
	}
	
	close( addr ){
		this.after_addr = addr;
	}
	
	store(){
		this.parser.disassembly.ParsedTables.add(this);
		this.parser.disassembly.ParsedContent.add(this);
		this.parser.disassembly.ShimOnlyROMNames.delete(this.addr);
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
		
		this.content.forEach( addr => asm.write( '\tdw ' + dis.getName(addr, 'rom') + '\n' ) );
	}
}

module.exports = Table;