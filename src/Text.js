let Address = require('./Address');

class Text {
	constructor( parser, addr ){
		this.parser = parser;
		this.addr = addr;
		
		this.type = 'Text';
		
		// Initialize some data
		this.content = [];
	}
	
	addContent(ch){
		this.content.push(ch);
	}
	
	getNextAddr(){
		return this.after_addr;
	}
	
	split( addr ){
		let node = new Text( this.parser, addr );
		
		node.content = this.content.splice( addr - this.addr );
		node.close(this.after_addr);
		
		this.close( addr );
		
		node.store();
	}
	
	close( addr ){
		this.after_addr = addr;
	}
	
	store(){
		this.parser.disassembly.ParsedTexts.add(this);
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
		
		asm.write( '\tdb "' + this.content.join('') + '"\n' );
	}
	
}

module.exports = Text;