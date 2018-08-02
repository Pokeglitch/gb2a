let Address = require('./Address'),
	Warning = require('./Warning');

class Data {
	constructor( parser, addr ){
		this.parser = parser;
		this.addr = addr;
		
		this.type = 'Data';
		
		// Initialize some data
		this.content = [];
	}
	
	addContent(value){
		this.content.push(value);
	}
	
	getNextAddr(){
		return this.after_addr;
	}
	
	split( addr ){
		let node = new Table( this.parser, addr );
		
		// A pointer is two bytes, so the index is the address different divided by 2
		node.content = this.content.splice(addr - this.addr);
		node.close(this.after_addr);
		
		this.close( addr );
		
		node.store();
	}
	
	close( addr ){
		this.after_addr = addr;
	}
	
	store(){
		this.parser.disassembly.ParsedData.add(this);
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
		
		let i = 0;
		
		while(i < this.content.length){
			asm.write('\tdb');
			for(let j=0; i < this.content.length && j < 8; j++, i++){
				if( j > 0 ){
					asm.write(',');
				}
				asm.write(' $' + Address.format( this.content[i], 2) );
			}
			asm.write('\n');
		}
	}
}

module.exports = Data;