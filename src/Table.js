let Address = require('./Address'),
	Warning = require('./Warning');

class Table {
	constructor( parser, addr ){
		this.parser = parser;
		this.addr = addr;
		
		this.type = 'Table';
		
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
	
		let i = (addr - this.addr)/2;
	
		// If the difference is not an integer, then error
		if( i % 1 ){
			Warning(`Cannot parse table at ${ Address.toBankString(addr,'rom') } since it intersects a pointer in an already existing Table`);
			return;
		}
	
		let node = new Table( this.parser, addr );
		
		// A pointer is two bytes, so the index is the address different divided by 2
		node.content = this.content.splice(i);
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