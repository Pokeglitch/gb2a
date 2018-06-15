function format( num, size ){
	let str = num.toString(16);
		
	for(let i = str.length; i < size; i++){
		str = '0' + str;
	}
	
	return str;
}

function toBankString(addr, type){
	let bank;
	
	if( type === 'rom' ){
		bank = Math.floor( addr / 0x4000 );
		
		if( bank ){
			addr = 0x4000 + (addr % 0x4000);
		}
	}
	else{
		bank = 0;
	}
	
	return format( bank, 2 ) + ':' + format( addr, 4 );
}


function toHexString( addr, type ){
	if( type === 'rom' ){
		let bank = Math.floor( addr / 0x4000 );
		
		if( bank ){
			addr = 0x4000 + (addr % 0x4000);
		}
	}
	
	return '$' + format( addr, 4 );
}

function parse( str ){
	let [bank, addr] = str.split(':');

	bank = parseInt( bank, 16 );
	addr = parseInt( addr, 16 );
	
	let type = addr < 0x8000 ? 'rom' : 'ram';
	
	if( 0x4000 <= addr && addr < 0x8000 ){
		addr += (bank - 1) * 0x4000;
	}
	
	return { type, addr };	
}

function toGlobal( bank, addr ){
	return bank ?
		(bank - 1) * 0x4000 + addr :
		addr;
}

function getAddr( bank_start, addr ){
	let type = addr < 0x8000 ? 'rom' : 'ram';
	
	// If not in the home bank, then the global value has an offset
	if( bank_start && 0x4000 <= addr && addr < 0x8000 ){
		addr += bank_start - 0x4000;
	}
	
	return { type, addr };
}

module.exports = { format, toBankString, toHexString, parse, toGlobal, getAddr }