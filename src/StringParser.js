let Address = require('./Address');

class StringParser {
	constructor( disassembly, addr ){
		this.disassembly = disassembly;
		this.addr = addr;
		
		// Pull some data from the disassembly
		this.EOS = disassembly.EOS;
		this.ByteToChar = disassembly.ByteToChar;
		
		this.ROM = disassembly.ROM;
		this.index = addr;
		this.String = "";
		
		this.parse();
		
		this.after_addr = this.index;
	}
	
	parse(){
		do {
			var value = this.ROM[this.index];
			
			this.String += this.ByteToChar.get(value);
			
			this.index += 1;
		} while( !this.EOS.has(value) );
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
		
		asm.write( '\tdb "' + this.String + '"\n' );
	}
}

module.exports = StringParser;